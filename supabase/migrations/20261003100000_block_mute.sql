-- Block and mute (GP-036)
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
