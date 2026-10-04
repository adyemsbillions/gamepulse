-- ============================================================================================
-- Manual apply for when `npx supabase db push` can't reach the database.
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once ("destructive operations" warnings are the drop-policy-if-exists
-- lines, which re-create rules; no data is removed). It also records both migrations as applied.
-- ============================================================================================

begin;

-- ---------------------------------------------------------------- 20261003100000_block_mute.sql-- Block and mute (GP-036)
--
-- Block (either way between two people):
--   * neither sees the other's reels or comments; profiles stay visible so you can unblock
--   * cheers, comments, replays and saves on the other's reels are refused (those policies only
--     allow reels you can see, and the reels policy now hides blocked people's reels)
--   * supporting is refused, and any support between the two is removed when the block is made
--   * no notifications pass between them (including @mentions), so no pushes either
-- Mute: private to the muter; the app leaves muted people's reels out of the Hot Now feed.

-- ---------------------------------------------------------------- tables

create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

create table if not exists public.mutes (
  muter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  constraint no_self_mute check (muter_id <> muted_id)
);

alter table public.blocks enable row level security;
alter table public.mutes enable row level security;

revoke all on public.blocks, public.mutes from anon, authenticated;
grant select, delete on public.blocks, public.mutes to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;
grant insert (muted_id) on public.mutes to authenticated;

-- Nobody can see who blocked or muted them; you only see your own list.
drop policy if exists "Users see who they blocked" on public.blocks;
create policy "Users see who they blocked"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "Users block others" on public.blocks;
create policy "Users block others"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists "Users unblock" on public.blocks;
create policy "Users unblock"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "Users see who they muted" on public.mutes;
create policy "Users see who they muted"
  on public.mutes for select to authenticated
  using (muter_id = (select auth.uid()));

drop policy if exists "Users mute others" on public.mutes;
create policy "Users mute others"
  on public.mutes for insert to authenticated
  with check (muter_id = (select auth.uid()));

drop policy if exists "Users unmute" on public.mutes;
create policy "Users unmute"
  on public.mutes for delete to authenticated
  using (muter_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpers

-- True if the signed-in user and `other` have blocked each other in either direction.
-- SECURITY DEFINER: it must see the other person's block of you, which RLS hides.
create or replace function public.blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and other is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other)
       or (b.blocker_id = other and b.blocked_id = auth.uid())
  );
$$;

-- Signed-out visitors too: the reels policy below runs it for them (it's always false then).
revoke execute on function public.blocked_with(uuid) from public;
grant execute on function public.blocked_with(uuid) to anon, authenticated;

-- Same check for two given people (used by triggers, which have no signed-in user).
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks x
    where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a)
  );
$$;

revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- visibility

drop policy if exists "Published reels are public; owners and staff see the rest" on public.reels;
create policy "Published reels are public; owners and staff see the rest"
  on public.reels for select to anon, authenticated
  using (
    (
      status = 'published'
      or user_id = (select auth.uid())
      or (select public.is_staff())
    )
    and not public.blocked_with(user_id)
  );

drop policy if exists "Comments follow reel visibility" on public.comments;
create policy "Comments follow reel visibility"
  on public.comments for select to anon, authenticated
  using (
    exists (select 1 from public.reels r where r.id = reel_id)
    and not public.blocked_with(user_id)
  );

drop policy if exists "Users support others" on public.supports;
create policy "Users support others"
  on public.supports for insert to authenticated
  with check (supporter_id = (select auth.uid()) and not public.blocked_with(creator_id));

-- ---------------------------------------------------------------- side effects

-- Blocking ends any support between the two (fan counts follow via the counter triggers).
create or replace function public.block_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.supports
  where (supporter_id = new.blocker_id and creator_id = new.blocked_id)
     or (supporter_id = new.blocked_id and creator_id = new.blocker_id);
  return null;
end;
$$;

revoke execute on function public.block_cleanup() from public, anon, authenticated;

create or replace trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.block_cleanup();

-- No notification (and so no push) between blocked people, whatever created it.
create or replace function public.skip_blocked_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.actor_id is not null and public.blocked_between(new.actor_id, new.recipient_id) then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.skip_blocked_notification() from public, anon, authenticated;

create or replace trigger notifications_skip_blocked before insert on public.notifications
  for each row execute function public.skip_blocked_notification();

-- ---------------------------------------------------------------- 20261003100100_rate_limits.sql-- Rate limits (GP-038)
-- Caps how fast one account can comment, cheer, replay, support and report, so a script or a
-- runaway client can't flood other people with notifications and pushes. Uploads are already
-- capped by the videos function (20 a day); sign-in attempts by Supabase Auth's own limits
-- (Dashboard → Authentication → Rate Limits).
--
-- Over the limit, the insert fails with SQLSTATE 'GP429' and a message written for users; the
-- app shows that message as-is.

create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- tg_argv: [0] user column, [1] max per minute, [2] max per hour, [3] message
  user_col text := tg_argv[0];
  per_minute integer := tg_argv[1]::integer;
  per_hour integer := tg_argv[2]::integer;
  uid uuid;
  last_minute integer;
  last_hour integer;
begin
  execute format('select ($1).%I', user_col) using new into uid;
  if uid is null then
    return new;
  end if;

  execute format(
    'select count(*) filter (where created_at > now() - interval ''1 minute''), count(*)
       from %I.%I where %I = $1 and created_at > now() - interval ''1 hour''',
    tg_table_schema, tg_table_name, user_col
  ) using uid into last_minute, last_hour;

  if last_minute >= per_minute or last_hour >= per_hour then
    raise exception using errcode = 'GP429', message = tg_argv[3];
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

-- Counting recent rows per user needs these.
create index if not exists comments_user_created_idx on public.comments (user_id, created_at);
create index if not exists cheers_user_created_idx on public.cheers (user_id, created_at);
create index if not exists replays_user_created_idx on public.replays (user_id, created_at);
create index if not exists supports_supporter_created_idx on public.supports (supporter_id, created_at);
create index if not exists reports_reporter_created_idx on public.reports (reporter_id, created_at);

create or replace trigger comments_rate_limit before insert on public.comments
  for each row execute function public.enforce_rate_limit(
    'user_id', '6', '100', 'You''re commenting very fast. Take a breather and try again in a minute.');

create or replace trigger cheers_rate_limit before insert on public.cheers
  for each row execute function public.enforce_rate_limit(
    'user_id', '40', '600', 'Easy on the Cheers! Try again in a minute.');

create or replace trigger replays_rate_limit before insert on public.replays
  for each row execute function public.enforce_rate_limit(
    'user_id', '20', '300', 'You''re replaying very fast. Try again in a minute.');

create or replace trigger supports_rate_limit before insert on public.supports
  for each row execute function public.enforce_rate_limit(
    'supporter_id', '20', '200', 'You''re supporting a lot of GameMakers at once. Try again in a few minutes.');

create or replace trigger reports_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limit(
    'reporter_id', '5', '30', 'You''ve sent a lot of reports. Our team is on it. Try again later.');

-- ---------------------------------------------------------------- record as applied
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('20261003100000', 'block_mute', '{}'),
  ('20261003100100', 'rate_limits', '{}')
on conflict (version) do nothing;

commit;