-- GamePulse access rules (GP-011)
--
-- Two layers:
--   1. Column privileges decide WHICH columns a signed-in user may write at all
--      (counters, roles, verification and reel status are never client-writable).
--   2. Row Level Security decides WHICH rows they may read or write.
-- The service role (edge functions, video webhooks, admin tools) bypasses both.

-- ---------------------------------------------------------------- owner defaults
-- Clients never send their own user id; the database fills it from the JWT.

alter table public.reels alter column user_id set default auth.uid();
alter table public.comments alter column user_id set default auth.uid();
alter table public.cheers alter column user_id set default auth.uid();
alter table public.comment_cheers alter column user_id set default auth.uid();
alter table public.saves alter column user_id set default auth.uid();
alter table public.replays alter column user_id set default auth.uid();
alter table public.supports alter column supporter_id set default auth.uid();
alter table public.reports alter column reporter_id set default auth.uid();

-- ---------------------------------------------------------------- column privileges

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

grant select on all tables in schema public to anon, authenticated;

grant update (username, display_name, bio, avatar_url, country, country_flag, favorite_club, onboarded)
  on public.profiles to authenticated;

grant insert (caption, duration_sec) on public.reels to authenticated;
grant update (caption) on public.reels to authenticated;
grant delete on public.reels to authenticated;

grant insert (reel_id, tag), delete on public.reel_hashtags to authenticated;

grant insert (reel_id, parent_id, body), delete on public.comments to authenticated;

grant insert (reel_id), delete on public.cheers to authenticated;
grant insert (comment_id), delete on public.comment_cheers to authenticated;
grant insert (reel_id), delete on public.saves to authenticated;
grant insert (reel_id), delete on public.replays to authenticated;
grant insert (creator_id), delete on public.supports to authenticated;

grant update (read), delete on public.notifications to authenticated;

grant insert (reel_id, comment_id, reported_user_id, reason, details) on public.reports to authenticated;
grant update (status, resolved_by, resolved_at) on public.reports to authenticated;

-- ---------------------------------------------------------------- enable RLS everywhere

alter table public.profiles enable row level security;
alter table public.reels enable row level security;
alter table public.hashtags enable row level security;
alter table public.reel_hashtags enable row level security;
alter table public.comments enable row level security;
alter table public.cheers enable row level security;
alter table public.comment_cheers enable row level security;
alter table public.saves enable row level security;
alter table public.replays enable row level security;
alter table public.supports enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- ---------------------------------------------------------------- profiles

create policy "Profiles are public"
  on public.profiles for select to anon, authenticated
  using (true);

create policy "Users edit their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- reels
-- Published reels are public. Owners also see their own drafts; staff see everything.

create policy "Published reels are public; owners and staff see the rest"
  on public.reels for select to anon, authenticated
  using (
    status = 'published'
    or user_id = (select auth.uid())
    or (select public.is_staff())
  );

create policy "Users create their own reels"
  on public.reels for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'uploading');

create policy "Owners edit their reels"
  on public.reels for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Owners delete their reels"
  on public.reels for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- hashtags

create policy "Hashtags are public"
  on public.hashtags for select to anon, authenticated
  using (true);

create policy "Tags follow reel visibility"
  on public.reel_hashtags for select to anon, authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id));

create policy "Owners tag their reels"
  on public.reel_hashtags for insert to authenticated
  with check (exists (select 1 from public.reels r where r.id = reel_id and r.user_id = (select auth.uid())));

create policy "Owners untag their reels"
  on public.reel_hashtags for delete to authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id and r.user_id = (select auth.uid())));

-- ---------------------------------------------------------------- comments

create policy "Comments follow reel visibility"
  on public.comments for select to anon, authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id));

create policy "Users comment on published reels"
  on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.reels r where r.id = reel_id and r.status = 'published')
  );

create policy "Authors, reel owners and staff delete comments"
  on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.reels r where r.id = reel_id and r.user_id = (select auth.uid()))
    or (select public.is_staff())
  );

-- ---------------------------------------------------------------- cheers, replays

create policy "Cheers follow reel visibility"
  on public.cheers for select to anon, authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id));

create policy "Users cheer published reels"
  on public.cheers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.reels r where r.id = reel_id and r.status = 'published')
  );

create policy "Users remove their cheers"
  on public.cheers for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Replays follow reel visibility"
  on public.replays for select to anon, authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id));

create policy "Users replay published reels"
  on public.replays for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.reels r where r.id = reel_id and r.status = 'published')
  );

create policy "Users remove their replays"
  on public.replays for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Comment cheers follow comment visibility"
  on public.comment_cheers for select to anon, authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));

create policy "Users cheer visible comments"
  on public.comment_cheers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id)
  );

create policy "Users remove their comment cheers"
  on public.comment_cheers for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- saves (private)

create policy "Users see their own saves"
  on public.saves for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users save visible reels"
  on public.saves for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.reels r where r.id = reel_id)
  );

create policy "Users remove their saves"
  on public.saves for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- supports

create policy "Supports are public"
  on public.supports for select to anon, authenticated
  using (true);

create policy "Users support others"
  on public.supports for insert to authenticated
  with check (supporter_id = (select auth.uid()));

create policy "Users stop supporting"
  on public.supports for delete to authenticated
  using (supporter_id = (select auth.uid()));

-- ---------------------------------------------------------------- notifications (private)
-- Rows are created by database triggers / edge functions, never by clients.

create policy "Users read their notifications"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy "Users mark their notifications read"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "Users clear their notifications"
  on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------- reports

create policy "Users file reports"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "Reporters and staff read reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_staff()));

create policy "Staff resolve reports"
  on public.reports for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- anon can read nothing here even though SELECT is granted table-wide.
revoke select on public.saves, public.notifications, public.reports from anon;
