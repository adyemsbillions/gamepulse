-- Uploads (GP-018 – GP-020)
-- Reels are created by the `videos` Edge Function (service role), which also creates the video on
-- Bunny Stream and hands the app a signed, time-limited upload. The same function (or Bunny's
-- webhook) moves the reel uploading → processing → published, or → failed.

-- How many uploads a user has started in the last day. The Edge Function refuses new uploads
-- past its limit, so a buggy or abusive client can't create unlimited videos on Bunny.
create or replace function public.recent_upload_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.reels
  where user_id = p_user_id
    and created_at > now() - interval '1 day';
$$;

revoke execute on function public.recent_upload_count(uuid) from public, anon, authenticated;
grant execute on function public.recent_upload_count(uuid) to service_role;

-- Fast lookup for the webhook (provider + asset id) already exists as reels_video_asset_idx.
-- Owners list their own uploads that are still in flight.
create index if not exists reels_user_status_idx on public.reels (user_id, status);
