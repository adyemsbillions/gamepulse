-- Weekly Challenges and Duets (responses)
--
-- Challenges: one hashtag a week. Entering (posting a Moment with the tag during the week) earns
-- +10 Pulse once per challenge. When the week ends, finish_challenges() (hourly, pg_cron) crowns
-- the entry with the most Cheers: +100 Pulse, a challenge win on their profile, and a notification
-- to everyone who entered.
-- Duets: a Moment can respond to another. The original's creator gets a notification and +4 Pulse
-- when the response is published.

-- ---------------------------------------------------------------- tables

alter table public.profiles add column if not exists challenge_wins integer not null default 0;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  tag text not null constraint challenge_tag_format check (tag ~ '^[a-z0-9_]{1,50}$'),
  title text not null,
  description text not null default '',
  emoji text not null default '⚽',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  winner_reel_id uuid references public.reels (id) on delete set null,
  winner_user_id uuid references public.profiles (id) on delete set null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint challenge_window check (ends_at > starts_at)
);
create unique index if not exists challenges_tag_start_idx on public.challenges (tag, starts_at);
create index if not exists challenges_window_idx on public.challenges (starts_at, ends_at);

alter table public.challenges enable row level security;
revoke all on public.challenges from anon, authenticated;
grant select on public.challenges to anon, authenticated;
grant insert, update, delete on public.challenges to authenticated;

drop policy if exists "Challenges are public" on public.challenges;
create policy "Challenges are public"
  on public.challenges for select to anon, authenticated
  using (true);

drop policy if exists "Staff manage challenges" on public.challenges;
create policy "Staff manage challenges"
  on public.challenges for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create table if not exists public.reel_replies (
  reel_id uuid primary key references public.reels (id) on delete cascade,
  reply_to uuid not null references public.reels (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_reply check (reel_id <> reply_to)
);
create index if not exists reel_replies_reply_to_idx on public.reel_replies (reply_to);

alter table public.reel_replies enable row level security;
revoke all on public.reel_replies from anon, authenticated;
grant select on public.reel_replies to anon, authenticated;
grant insert (reel_id, reply_to) on public.reel_replies to authenticated;

-- A link is visible when the responding reel is (so drafts and blocked people stay hidden).
drop policy if exists "Responses follow reel visibility" on public.reel_replies;
create policy "Responses follow reel visibility"
  on public.reel_replies for select to anon, authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id));

-- Only for your own reel, and only to a published reel you can see.
drop policy if exists "Users link their responses" on public.reel_replies;
create policy "Users link their responses"
  on public.reel_replies for insert to authenticated
  with check (
    exists (select 1 from public.reels r where r.id = reel_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.reels o where o.id = reply_to and o.status = 'published')
  );

-- ---------------------------------------------------------------- the first eight weeks

insert into public.challenges (tag, title, description, emoji, starts_at, ends_at)
select c.tag, c.title, c.description, c.emoji,
       public.pulse_week_start() + (c.week * interval '7 days'),
       public.pulse_week_start() + ((c.week + 1) * interval '7 days')
from (values
  (0, 'pannachallenge', 'Panna Challenge', 'Nutmeg someone. Clean, cheeky, on camera.', '🥜'),
  (1, 'keepyuppy', 'Keepy-Uppy Count', 'How many touches before it drops? Count out loud.', '🔢'),
  (2, 'freekickfriday', 'Free Kick Friday', 'Bend it. Top bins or it doesn''t count.', '🎯'),
  (3, 'keeperheroics', 'Keeper Heroics', 'Your best save: dive, tip it over, or claim it clean.', '🧤'),
  (4, 'trickshot', 'Trick Shot', 'Crossbar, bin, washing line: hit something impossible.', '🪣'),
  (5, 'signatureskill', 'Signature Skill', 'Show the move defenders hate.', '🌀'),
  (6, 'streetfootball', 'Street Football', 'Gutter, sand or concrete. Show us your pitch.', '🏘️'),
  (7, 'celebrationremix', 'Celebration Remix', 'Recreate a famous goal celebration.', '🕺')
) as c(week, tag, title, description, emoji)
on conflict (tag, starts_at) do nothing;

-- Make sure each challenge's hashtag exists so its page works before the first entry.
insert into public.hashtags (name)
select tag from public.challenges
on conflict (name) do nothing;

-- ---------------------------------------------------------------- reading

-- Entries so far (computed field: select=*,entry_count).
create or replace function public.entry_count(c public.challenges)
returns bigint
language sql
stable
set search_path = ''
as $$
  select count(*)
  from public.reels r
  join public.reel_hashtags t on t.reel_id = r.id and t.tag = c.tag
  where r.status = 'published'
    and coalesce(r.published_at, r.created_at) >= c.starts_at
    and coalesce(r.published_at, r.created_at) < c.ends_at;
$$;
grant execute on function public.entry_count(public.challenges) to anon, authenticated;

-- A challenge's entries, most Cheers first.
create or replace function public.challenge_reels(p_challenge uuid, p_offset integer default 0, p_limit integer default 18)
returns setof public.reels
language sql
stable
set search_path = ''
as $$
  select r.*
  from public.challenges c
  join public.reel_hashtags t on t.tag = c.tag
  join public.reels r on r.id = t.reel_id
  where c.id = p_challenge
    and r.status = 'published'
    and coalesce(r.published_at, r.created_at) >= c.starts_at
    and coalesce(r.published_at, r.created_at) < c.ends_at
  order by r.cheers_count desc, r.replays_count desc, r.comments_count desc, r.published_at asc, r.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.challenge_reels(uuid, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------- earning (extends pulse.sql)

alter table public.pulse_events drop constraint if exists pulse_events_kind_check;
alter table public.pulse_events add constraint pulse_events_kind_check
  check (kind in ('post', 'cheer', 'comment', 'replay', 'fan', 'daily', 'challenge', 'challenge_win', 'response'));

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

      -- Entering this week's challenge (tagged with its hashtag while it runs).
      perform public.award_pulse(new.user_id, 'challenge', 10, 'challenge:' || c.id)
      from public.challenges c
      where now() >= c.starts_at and now() < c.ends_at
        and exists (select 1 from public.reel_hashtags t where t.reel_id = new.id and t.tag = c.tag);

      -- A response (duet): tell the original's creator and give them points.
      select o.user_id into owner
      from public.reel_replies x join public.reels o on o.id = x.reply_to
      where x.reel_id = new.id;
      if owner is not null and owner <> new.user_id then
        perform public.award_pulse(owner, 'response', 4, 'response:' || new.id);
        insert into public.notifications (recipient_id, type, actor_id, reel_id)
        values (owner, 'response', new.user_id, new.id);
      end if;
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

-- ---------------------------------------------------------------- crowning winners

create or replace function public.finish_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  winner_reel uuid;
  winner uuid;
  winner_name text;
  done integer := 0;
begin
  for c in
    select * from public.challenges where ends_at <= now() and finished_at is null order by ends_at for update
  loop
    winner_reel := null;
    winner := null;
    select r.id, r.user_id into winner_reel, winner
    from public.reels r
    join public.reel_hashtags t on t.reel_id = r.id and t.tag = c.tag
    where r.status = 'published'
      and coalesce(r.published_at, r.created_at) >= c.starts_at
      and coalesce(r.published_at, r.created_at) < c.ends_at
    order by r.cheers_count desc, r.replays_count desc, r.comments_count desc, r.published_at asc, r.id
    limit 1;

    update public.challenges
       set finished_at = now(), winner_reel_id = winner_reel, winner_user_id = winner
     where id = c.id;

    if winner is not null then
      select username into winner_name from public.profiles where id = winner;
      perform public.award_pulse(winner, 'challenge_win', 100, 'challenge_win:' || c.id);
      update public.profiles set challenge_wins = challenge_wins + 1 where id = winner;

      insert into public.notifications (recipient_id, type, reel_id, body)
      values (winner, 'system', winner_reel, '🏆 You won the #' || c.tag || ' challenge! +100 Pulse');

      insert into public.notifications (recipient_id, type, reel_id, body)
      select distinct r.user_id, 'system'::public.notification_type, winner_reel,
             '🏆 @' || winner_name || ' won the #' || c.tag || ' challenge. This week''s challenge is live!'
      from public.reels r
      join public.reel_hashtags t on t.reel_id = r.id and t.tag = c.tag
      where r.status = 'published'
        and r.user_id <> winner
        and coalesce(r.published_at, r.created_at) >= c.starts_at
        and coalesce(r.published_at, r.created_at) < c.ends_at;
    end if;
    done := done + 1;
  end loop;
  return done;
end;
$$;
revoke execute on function public.finish_challenges() from public, anon, authenticated;

-- Every hour at :07. If pg_cron isn't available, winners can be crowned by running
-- `select public.finish_challenges();` (the app shows "results coming" meanwhile).
do $outer$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('finish-challenges', '7 * * * *', 'select public.finish_challenges()');
exception when others then
  raise notice 'pg_cron not set up (%); run select public.finish_challenges() to crown winners', sqlerrm;
end;
$outer$;
