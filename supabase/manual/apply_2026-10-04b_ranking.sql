-- ============================================================================================
-- Manual apply for when `npx supabase db push` can't reach the database.
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once ("destructive operations" warnings are the drop-policy-if-exists
-- lines, which re-create rules; no data is removed). It also records the migration as applied.
-- Needs apply_2026-10-04.sql (block and mute) to have been run first: Hot Now leaves out muted people.
-- ============================================================================================

begin;

-- ---------------------------------------------------------------- 20261004100000_ranking.sql-- Ranking (GP-025 Hot Now, GP-029 trending hashtags, GP-030 Not interested)

-- ---------------------------------------------------------------- Not interested

-- "Not interested" on a reel: it never shows in that person's Hot Now again, and the creator's
-- other reels rank lower for them. Private.
create table if not exists public.hidden_reels (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reel_id uuid not null references public.reels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);

alter table public.hidden_reels enable row level security;
revoke all on public.hidden_reels from anon, authenticated;
grant select, delete on public.hidden_reels to authenticated;
grant insert (reel_id) on public.hidden_reels to authenticated;

drop policy if exists "Users see what they hid" on public.hidden_reels;
create policy "Users see what they hid"
  on public.hidden_reels for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users hide reels" on public.hidden_reels;
create policy "Users hide reels"
  on public.hidden_reels for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users unhide reels" on public.hidden_reels;
create policy "Users unhide reels"
  on public.hidden_reels for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- Hot score

-- Engagement over age. Comments, replays and shares count for more than a cheer because they
-- take more effort; views count a little so brand-new reels with no taps still get a chance.
-- The age term (hours + 2)^1.5 lets a strong reel stay near the top for a day or two, then fade.
create or replace function public.hot_score(r public.reels, as_of timestamptz)
returns double precision
language sql
stable
set search_path = ''
as $$
  select (
    1
    + r.cheers_count
    + 3 * r.comments_count
    + 4 * r.replays_count
    + 5 * r.shares_count
    + 0.05 * r.views_count
  )::double precision
  / power(greatest(extract(epoch from (as_of - coalesce(r.published_at, r.created_at))) / 3600.0, 0) + 2, 1.5);
$$;

grant execute on function public.hot_score(public.reels, timestamptz) to anon, authenticated;

-- One page of the ranked feed, as of a fixed moment so pages don't shift while you scroll
-- (reels published after `p_as_of` wait for the next refresh). With `p_hashtag`: the top reels for
-- that hashtag. Mutes and Not interested apply to Hot Now; blocks apply everywhere (reels RLS).
create or replace function public.hot_reels(
  p_as_of timestamptz default now(),
  p_offset integer default 0,
  p_limit integer default 10,
  p_hashtag text default null
)
returns setof public.reels
language sql
stable
set search_path = ''
as $$
  select r.*
  from public.reels r
  where r.status = 'published'
    and coalesce(r.published_at, r.created_at) <= p_as_of
    and (p_hashtag is null or exists (
      select 1 from public.reel_hashtags t where t.reel_id = r.id and t.tag = p_hashtag
    ))
    and (p_hashtag is not null or auth.uid() is null or not exists (
      select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = r.user_id
    ))
    and (p_hashtag is not null or auth.uid() is null or not exists (
      select 1 from public.hidden_reels h where h.user_id = auth.uid() and h.reel_id = r.id
    ))
  order by
    public.hot_score(r, p_as_of)
      -- "Show me less of this": creators you've hidden a reel from rank much lower for you.
      * case when auth.uid() is not null and exists (
          select 1 from public.hidden_reels h
          join public.reels hr on hr.id = h.reel_id
          where h.user_id = auth.uid() and hr.user_id = r.user_id
        ) then 0.25 else 1 end
      desc,
    r.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.hot_reels(timestamptz, integer, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------- Trending hashtags

-- How hot each hashtag's reels from the last 7 days are, added up. Computed when asked, so it's
-- always current. Hashtags with nothing recent fall back to all-time use.
create or replace function public.trending_hashtags(p_limit integer default 20)
returns table (name text, usage_count integer, trending_score double precision)
language sql
stable
set search_path = ''
as $$
  select
    h.name,
    h.usage_count,
    coalesce(sum(public.hot_score(r, now())), 0) as trending_score
  from public.hashtags h
  left join public.reel_hashtags t on t.tag = h.name
  left join public.reels r
    on r.id = t.reel_id
   and r.status = 'published'
   and r.published_at > now() - interval '7 days'
  where h.usage_count > 0
  group by h.name, h.usage_count
  order by trending_score desc, h.usage_count desc, h.name
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.trending_hashtags(integer) to anon, authenticated;

-- ---------------------------------------------------------------- record as applied
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261004100000', 'ranking', '{}')
on conflict (version) do nothing;

commit;