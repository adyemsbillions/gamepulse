-- GamePulse counters (GP-015)
-- Denormalised *_count columns are maintained here so feeds never count rows at read time.
-- Trigger functions are SECURITY DEFINER because clients have no write access to counters.

create or replace function public.bump_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  r record := case when tg_op = 'INSERT' then new else old end;
begin
  case tg_table_name
    when 'cheers' then
      update public.reels set cheers_count = greatest(cheers_count + delta, 0) where id = r.reel_id;
    when 'replays' then
      update public.reels set replays_count = greatest(replays_count + delta, 0) where id = r.reel_id;
    when 'comments' then
      update public.reels set comments_count = greatest(comments_count + delta, 0) where id = r.reel_id;
    when 'comment_cheers' then
      update public.comments set cheers_count = greatest(cheers_count + delta, 0) where id = r.comment_id;
    when 'reel_hashtags' then
      update public.hashtags set usage_count = greatest(usage_count + delta, 0) where name = r.tag;
    when 'supports' then
      update public.profiles set fans_count = greatest(fans_count + delta, 0) where id = r.creator_id;
      update public.profiles set supporting_count = greatest(supporting_count + delta, 0) where id = r.supporter_id;
  end case;
  return null;
end;
$$;

create trigger cheers_count after insert or delete on public.cheers
  for each row execute function public.bump_counter();
create trigger replays_count after insert or delete on public.replays
  for each row execute function public.bump_counter();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_counter();
create trigger comment_cheers_count after insert or delete on public.comment_cheers
  for each row execute function public.bump_counter();
create trigger reel_hashtags_count after insert or delete on public.reel_hashtags
  for each row execute function public.bump_counter();
create trigger supports_count after insert or delete on public.supports
  for each row execute function public.bump_counter();

-- Shares and views have no rows of their own; the app reports them through these calls.
-- They only count published reels.

create or replace function public.record_share(p_reel_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.reels set shares_count = shares_count + 1
  where id = p_reel_id and status = 'published';
$$;

create or replace function public.record_view(p_reel_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.reels set views_count = views_count + 1
  where id = p_reel_id and status = 'published';
$$;

revoke execute on function public.record_share(uuid), public.record_view(uuid) from public;
grant execute on function public.record_share(uuid), public.record_view(uuid) to anon, authenticated;

-- Trigger-only functions must not be callable over the API.
revoke execute on function public.bump_counter() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_hashtag() from public, anon, authenticated;
revoke execute on function public.check_reply_parent() from public, anon, authenticated;
