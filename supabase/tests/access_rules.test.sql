-- Access-rule and counter tests for the GamePulse schema.
-- Runs against a database with the migrations applied (see supabase/tests/README.md).
-- Every check raises on failure; a clean run ends with "ALL TESTS PASSED".

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create schema if not exists t;
grant usage on schema t to anon, authenticated, service_role;

-- must_fail: run a statement that the rules must refuse.
create or replace function t.must_fail(label text, q text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FAILED (was allowed): %', label;
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
end $$;

-- must_affect: run a statement and require an exact row count (0 = silently filtered by RLS).
create or replace function t.must_affect(label text, q text, expected int) returns void language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'FAILED: % (affected %, expected %)', label, n, expected; end if;
end $$;

create or replace function t.eq(label text, actual bigint, expected bigint) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAILED: % (got %, expected %)', label, actual, expected; end if;
end $$;

grant execute on all functions in schema t to anon, authenticated, service_role;

-- Fixture users: A (creator), B (fan), S (staff)
insert into auth.users (id, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"full_name":"Ada Creator","avatar_url":"https://lh3.example/a.png"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '{}'),
  ('55555555-0000-0000-0000-000000000003', '{}');
update public.profiles set role = 'admin' where id = '55555555-0000-0000-0000-000000000003';

select t.eq('profile auto-created per auth user', (select count(*) from public.profiles), 3);
select t.eq('display name taken from sign-up metadata',
  (select count(*) from public.profiles where display_name = 'Ada Creator'), 1);
select t.eq('Google photo taken from sign-up metadata',
  (select count(*) from public.profiles where avatar_url = 'https://lh3.example/a.png'), 1);
select t.eq('every new account gets a welcome', (select count(*) from public.notifications where type = 'system'), 3);

-- ============================================================ as A
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

select t.must_affect('A edits own profile',
  $q$update public.profiles set username = 'ada_goals', bio = 'Left foot only' where id = auth.uid()$q$, 1);
select t.must_affect('A cannot edit B profile',
  $q$update public.profiles set bio = 'hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0);
select t.must_fail('A cannot make self admin', $q$update public.profiles set role = 'admin' where id = auth.uid()$q$);
select t.must_fail('A cannot self-verify', $q$update public.profiles set verified = true where id = auth.uid()$q$);
select t.must_fail('A cannot set fan count', $q$update public.profiles set fans_count = 1000000 where id = auth.uid()$q$);
select t.must_fail('username format enforced', $q$update public.profiles set username = 'Bad Name!' where id = auth.uid()$q$);

insert into public.reels (caption) values ('Top bins from 30 yards');
select t.eq('new reel starts as uploading and owned by A',
  (select count(*) from public.reels where user_id = auth.uid() and status = 'uploading'), 1);
select t.must_fail('A cannot create a reel already published',
  $q$insert into public.reels (caption, status) values ('skip review', 'published')$q$);
select t.must_fail('A cannot create a reel for someone else',
  $q$insert into public.reels (caption, user_id) values ('x', 'bbbbbbbb-0000-0000-0000-000000000002')$q$);
select t.must_fail('A cannot publish own reel directly',
  $q$update public.reels set status = 'published' where user_id = auth.uid()$q$);
reset role;
select id as reel from public.reels \gset
set role authenticated;

select t.must_affect('A edits own caption',
  $q$update public.reels set caption = 'Top bins from 35 yards' where user_id = auth.uid()$q$, 1);

insert into public.reel_hashtags (reel_id, tag)
  select id, 'NaijaFootball' from public.reels where user_id = auth.uid();
select t.eq('hashtag lowercased and created', (select count(*) from public.hashtags where name = 'naijafootball'), 1);
select t.must_fail('A cannot write hashtags table directly', $q$insert into public.hashtags (name) values ('spam')$q$);

-- ============================================================ as B, while A's reel is still processing
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select t.eq('B cannot see A draft reel', (select count(*) from public.reels), 0);
select t.must_fail('B cannot cheer a draft',
  format($q$insert into public.cheers (reel_id) values (%L)$q$, :'reel'));
select t.must_fail('B cannot comment on a draft',
  format($q$insert into public.comments (reel_id, body) values (%L, 'first')$q$, :'reel'));

-- ============================================================ video webhook publishes (service role)
reset role;
set role service_role;
update public.reels set status = 'published', video_provider = 'bunny', video_asset_id = 'vid_1',
  playback_url = 'https://cdn.example/vid_1.m3u8'
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select t.eq('published_at stamped', (select count(*) from public.reels where published_at is not null), 1);

-- ============================================================ anon
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.eq('anon sees the published reel', (select count(*) from public.reels), 1);
select t.eq('anon sees tags on it', (select count(*) from public.reel_hashtags), 1);
select t.must_fail('anon cannot cheer', format($q$insert into public.cheers (reel_id) values (%L)$q$, :'reel'));
select t.must_fail('anon cannot read notifications', $q$select * from public.notifications$q$);
select t.must_fail('anon cannot read saves', $q$select * from public.saves$q$);
select public.record_view(id) from public.reels;
select public.record_share(id) from public.reels;

-- ============================================================ as B, engaging
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);

insert into public.cheers (reel_id) select id from public.reels;
select t.eq('cheer counted', (select cheers_count from public.reels), 1);
select t.must_fail('cheer is once per user', format($q$insert into public.cheers (reel_id) values (%L)$q$, :'reel'));
select t.must_fail('B cannot cheer as A',
  format($q$insert into public.cheers (reel_id, user_id) values (%L, 'aaaaaaaa-0000-0000-0000-000000000001')$q$, :'reel'));

insert into public.replays (reel_id) select id from public.reels;
insert into public.saves (reel_id) select id from public.reels;
insert into public.comments (reel_id, body) select id, 'What a strike' from public.reels;
insert into public.comments (reel_id, parent_id, body)
  select reel_id, id, 'Replying to myself' from public.comments;
select t.eq('comments counted incl. replies', (select comments_count from public.reels), 2);
select t.must_fail('reply must be on the same reel',
  $q$insert into public.comments (reel_id, parent_id, body) values (gen_random_uuid(), (select id from public.comments limit 1), 'x')$q$);
select t.must_fail('empty comment refused', $q$insert into public.comments (reel_id, body) select id, '   ' from public.reels$q$);
insert into public.comment_cheers (comment_id) select id from public.comments where parent_id is null;
select t.eq('comment cheer counted', (select cheers_count from public.comments where parent_id is null), 1);

insert into public.supports (creator_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
select t.must_fail('cannot support yourself',
  $q$insert into public.supports (creator_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$q$);
select t.eq('A gained a fan', (select fans_count from public.profiles where username = 'ada_goals'), 1);
select t.eq('B supports one creator', (select supporting_count from public.profiles where id = auth.uid()), 1);

select t.must_affect('B cannot edit A caption', $q$update public.reels set caption = 'hijack'$q$, 0);
select t.must_affect('B cannot delete A reel', $q$delete from public.reels$q$, 0);
select t.must_fail('B cannot tag A reel', format($q$insert into public.reel_hashtags (reel_id, tag) values (%L, 'spam')$q$, :'reel'));

insert into public.reports (reel_id, reason, details) select id, 'spam', 'test report' from public.reels;
select t.eq('B sees own report', (select count(*) from public.reports), 1);
select t.must_affect('B cannot resolve reports', $q$update public.reports set status = 'dismissed'$q$, 0);

-- ============================================================ counters (as service role)
reset role;
set role service_role;
select t.eq('counters: 1 view, 1 share, 1 replay',
  (select views_count + shares_count + replays_count from public.reels), 3);

-- ============================================================ as A again
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select t.eq('A: welcome message', (select count(*) from public.notifications where type = 'system'), 1);
select t.eq('A: notified of B cheer', (select count(*) from public.notifications where type = 'cheer' and actor_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1);
select t.eq('A: notified of B replay', (select count(*) from public.notifications where type = 'replay'), 1);
select t.eq('A: notified of both comments on her reel', (select count(*) from public.notifications where type = 'comment'), 2);
select t.eq('A: notified of new fan', (select count(*) from public.notifications where type = 'new_fan'), 1);
select t.eq('A: nothing about her own actions', (select count(*) from public.notifications where actor_id = auth.uid()), 0);
select t.must_affect('A marks them read', $q$update public.notifications set read = true$q$, 6);
select t.must_fail('A cannot rewrite notification type', $q$update public.notifications set type = 'system'$q$);
select t.eq('A cannot see B saves', (select count(*) from public.saves), 0);
select t.eq('A cannot see B report', (select count(*) from public.reports), 0);
select t.must_affect('reel owner removes a comment on their reel',
  $q$delete from public.comments where body = 'Replying to myself'$q$, 1);
select t.eq('comment count follows delete', (select comments_count from public.reels), 1);

-- ============================================================ as B: notifications are private
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select t.eq('B cannot see A notifications', (select count(*) from public.notifications where recipient_id <> auth.uid()), 0);
delete from public.cheers;
select t.eq('uncheer decrements', (select cheers_count from public.reels), 0);
insert into public.cheers (reel_id) select id from public.reels;
select t.eq('B sees only own notifications (welcome)', (select count(*) from public.notifications), 1);

-- ============================================================ as staff S
select set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-000000000003', false);
select t.eq('staff see all reports', (select count(*) from public.reports), 1);
select t.must_affect('staff resolve report',
  $q$update public.reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now()$q$, 1);
insert into public.comments (reel_id, body)
  select id, 'Shout out @fan_bbbbbbbb0000 and @ada_goals and @nobody_here' from public.reels;

reset role;
select t.eq('re-cheer within a day does not notify again',
  (select count(*) from public.notifications where type = 'cheer'), 1);
select t.eq('mention notifies the named fan',
  (select count(*) from public.notifications where type = 'mention' and recipient_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1);
select t.eq('reel owner gets a comment notification, not a duplicate mention',
  (select count(*) from public.notifications where type = 'mention' and recipient_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0);
select t.eq('avatar and name copied from sign-up metadata',
  (select count(*) from public.profiles where display_name = 'Ada Creator'), 1);

reset role;
\o
\echo ALL TESTS PASSED
