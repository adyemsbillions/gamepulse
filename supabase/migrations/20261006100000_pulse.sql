-- Pulse Rank and Club Wars
--
-- Pulse Points come from what other people do with your Moments (and a daily check-in), never
-- from your own taps, so they can't be farmed by cheering on and off: every award has a unique
-- key (e.g. one Cheer award per person per Moment). Ranks come from all-time points; Top fans and
-- Club Wars from points earned this week (Monday 00:00 to Sunday 23:59, Lagos time).

-- ---------------------------------------------------------------- ledger and totals

create table if not exists public.pulse_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'cheer', 'comment', 'replay', 'fan', 'daily')),
  points integer not null check (points > 0),
  -- What the award is for, so it's given once: 'cheer:<reel>:<cheerer>', 'daily:2026-10-06'…
  award_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, award_key)
);
create index if not exists pulse_events_week_idx on public.pulse_events (created_at, user_id);

alter table public.pulse_events enable row level security;
revoke all on public.pulse_events from anon, authenticated;

drop policy if exists "Users see their own points" on public.pulse_events;
create policy "Users see their own points"
  on public.pulse_events for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.pulse_events to authenticated;

-- Public: total points and the current streak. Clients can't write them (the profiles update
-- grant is a column list that doesn't include them).
alter table public.profiles add column if not exists pulse_points integer not null default 0;
alter table public.profiles add column if not exists streak_days integer not null default 0;
alter table public.profiles add column if not exists streak_best integer not null default 0;

-- Private bookkeeping for streaks (when you last checked in, when you last used your weekly
-- "missed a day" pass). Kept off profiles so nobody can see when someone was last active.
create table if not exists public.pulse_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_active_date date not null,
  freeze_week date
);
alter table public.pulse_streaks enable row level security;
revoke all on public.pulse_streaks from anon, authenticated;

-- Monday 00:00 this week, Lagos time.
create or replace function public.pulse_week_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
$$;
grant execute on function public.pulse_week_start() to anon, authenticated;

-- Give points once per award key. Returns true if they were given.
create or replace function public.award_pulse(
  p_user uuid,
  p_kind text,
  p_points integer,
  p_key text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return false;
  end if;
  insert into public.pulse_events (user_id, kind, points, award_key, created_at)
  values (p_user, p_kind, p_points, p_key, p_at)
  on conflict (user_id, award_key) do nothing;
  if not found then
    return false;
  end if;
  update public.profiles set pulse_points = pulse_points + p_points where id = p_user;
  return true;
end;
$$;
revoke execute on function public.award_pulse(uuid, text, integer, text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- earning

create or replace function public.pulse_from_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_table_name = 'reels' then
    if new.status = 'published' and old.status is distinct from 'published' then
      perform public.award_pulse(new.user_id, 'post', 20, 'post:' || new.id);
    end if;
    return null;
  end if;

  if tg_table_name = 'supports' then
    perform public.award_pulse(new.creator_id, 'fan', 5, 'fan:' || new.supporter_id);
    return null;
  end if;

  select r.user_id into owner from public.reels r where r.id = new.reel_id and r.status = 'published';
  -- Nothing for engaging with your own Moments.
  if owner is null or owner = new.user_id then
    return null;
  end if;

  case tg_table_name
    when 'cheers' then perform public.award_pulse(owner, 'cheer', 2, 'cheer:' || new.reel_id || ':' || new.user_id);
    when 'comments' then perform public.award_pulse(owner, 'comment', 3, 'comment:' || new.reel_id || ':' || new.user_id);
    when 'replays' then perform public.award_pulse(owner, 'replay', 4, 'replay:' || new.reel_id || ':' || new.user_id);
  end case;
  return null;
end;
$$;
revoke execute on function public.pulse_from_activity() from public, anon, authenticated;

create or replace trigger reels_pulse after update of status on public.reels
  for each row execute function public.pulse_from_activity();
create or replace trigger cheers_pulse after insert on public.cheers
  for each row execute function public.pulse_from_activity();
create or replace trigger comments_pulse after insert on public.comments
  for each row execute function public.pulse_from_activity();
create or replace trigger replays_pulse after insert on public.replays
  for each row execute function public.pulse_from_activity();
create or replace trigger supports_pulse after insert on public.supports
  for each row execute function public.pulse_from_activity();

-- Daily check-in: +5, plus 1 per day of streak (up to +10 more). Missing one day a week keeps the
-- streak going (a free pass, used automatically); missing more starts it again.
create or replace function public.pulse_check_in()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Africa/Lagos')::date;
  this_week date := date_trunc('week', today)::date;
  s public.pulse_streaks;
  streak integer;
  used_pass boolean := false;
  points integer;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and onboarded) then
    return null;
  end if;

  select * into s from public.pulse_streaks where user_id = uid for update;

  if s.user_id is not null and s.last_active_date = today then
    return jsonb_build_object('awarded', 0, 'streak', (select streak_days from public.profiles where id = uid));
  end if;

  select streak_days into streak from public.profiles where id = uid;
  if s.user_id is not null and s.last_active_date = today - 1 then
    streak := streak + 1;
  elsif s.user_id is not null and s.last_active_date = today - 2 and s.freeze_week is distinct from this_week then
    streak := streak + 1;
    used_pass := true;
  else
    streak := 1;
  end if;

  insert into public.pulse_streaks (user_id, last_active_date, freeze_week)
  values (uid, today, case when used_pass then this_week end)
  on conflict (user_id) do update
    set last_active_date = excluded.last_active_date,
        freeze_week = case when used_pass then this_week else public.pulse_streaks.freeze_week end;

  update public.profiles
     set streak_days = streak, streak_best = greatest(streak_best, streak)
   where id = uid;

  points := 5 + least(streak - 1, 10);
  perform public.award_pulse(uid, 'daily', points, 'daily:' || today);

  return jsonb_build_object('awarded', points, 'streak', streak, 'usedPass', used_pass);
end;
$$;
revoke execute on function public.pulse_check_in() from public, anon;
grant execute on function public.pulse_check_in() to authenticated;

-- ---------------------------------------------------------------- tables

-- Top fans this week (optionally one country), with their public profile.
create or replace function public.pulse_top_fans(p_country text default null, p_limit integer default 50)
returns table (
  id uuid, username text, display_name text, bio text, avatar_url text, country text,
  country_flag text, favorite_club text, verified boolean, onboarded boolean, fans_count integer,
  supporting_count integer, pulse_points integer, streak_days integer,
  week_points bigint, place bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with week as (
    select e.user_id, sum(e.points) as pts
    from public.pulse_events e
    where e.created_at >= public.pulse_week_start()
    group by e.user_id
  ),
  ranked as (
    select p.*, w.pts, rank() over (order by w.pts desc, p.pulse_points desc, p.id) as place
    from week w
    join public.profiles p on p.id = w.user_id
    where p.onboarded and (p_country is null or p.country = p_country)
  )
  select id, username, display_name, bio, avatar_url, country, country_flag, favorite_club,
         verified, onboarded, fans_count, supporting_count, pulse_points, streak_days, pts, place
  from ranked
  order by place
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.pulse_top_fans(text, integer) to anon, authenticated;

-- The signed-in user's points and position this week (everywhere and in their country).
create or replace function public.pulse_my_week()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with week as (
    select e.user_id, sum(e.points) as pts
    from public.pulse_events e
    where e.created_at >= public.pulse_week_start()
    group by e.user_id
  ),
  me as (select p.id, p.country from public.profiles p where p.id = auth.uid()),
  mine as (select coalesce((select pts from week where user_id = auth.uid()), 0) as pts)
  select jsonb_build_object(
    'points', (select pts from mine),
    'position', case when (select pts from mine) = 0 then null else
      1 + (select count(*) from week w join public.profiles p on p.id = w.user_id
           where p.onboarded and w.pts > (select pts from mine)) end,
    'countryPosition', case when (select pts from mine) = 0 then null else
      1 + (select count(*) from week w join public.profiles p on p.id = w.user_id
           where p.onboarded and p.country = (select country from me) and w.pts > (select pts from mine)) end
  )
  where exists (select 1 from me);
$$;
grant execute on function public.pulse_my_week() to authenticated;

-- Club Wars: each club's fans pool the points they earn this week.
create or replace function public.club_wars(p_limit integer default 50)
returns table (club text, points bigint, fans bigint, place bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with week as (
    select e.user_id, sum(e.points) as pts
    from public.pulse_events e
    where e.created_at >= public.pulse_week_start()
    group by e.user_id
  ),
  clubs as (
    select
      lower(trim(p.favorite_club)) as k,
      mode() within group (order by trim(p.favorite_club)) as club,
      count(*) as fans,
      coalesce(sum(w.pts), 0) as points
    from public.profiles p
    left join week w on w.user_id = p.id
    where p.onboarded and trim(p.favorite_club) <> ''
    group by lower(trim(p.favorite_club))
  )
  select club, points, fans, rank() over (order by points desc, fans desc, club) as place
  from clubs
  order by place
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.club_wars(integer) to anon, authenticated;

-- ---------------------------------------------------------------- credit for what already happened

select public.award_pulse(r.user_id, 'post', 20, 'post:' || r.id, coalesce(r.published_at, r.created_at))
from public.reels r where r.status = 'published';

select public.award_pulse(r.user_id, 'cheer', 2, 'cheer:' || c.reel_id || ':' || c.user_id, c.created_at)
from public.cheers c join public.reels r on r.id = c.reel_id
where r.status = 'published' and r.user_id <> c.user_id;

select public.award_pulse(r.user_id, 'comment', 3, 'comment:' || c.reel_id || ':' || c.user_id, c.created_at)
from public.comments c join public.reels r on r.id = c.reel_id
where r.status = 'published' and r.user_id <> c.user_id;

select public.award_pulse(r.user_id, 'replay', 4, 'replay:' || x.reel_id || ':' || x.user_id, x.created_at)
from public.replays x join public.reels r on r.id = x.reel_id
where r.status = 'published' and r.user_id <> x.user_id;

select public.award_pulse(s.creator_id, 'fan', 5, 'fan:' || s.supporter_id, s.created_at)
from public.supports s;
