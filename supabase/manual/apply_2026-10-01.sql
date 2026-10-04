-- ============================================================================================
-- Manual apply for when `npx supabase db push` can't reach the database.
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once. It also records both migrations as applied, so a later
-- `npx supabase db push` won't try to run them again.
--
-- The last statement points push notifications at the STAGING project
-- (priumjuvygdulevqxkza). For production, run it again with that project's URL.
-- ============================================================================================

begin;

-- ---------------------------------------------------------------- 20261001100000_avatars.sql
-- Profile photos (GP-032)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users list their own avatar files" on storage.objects;
create policy "Users list their own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users replace their own avatar" on storage.objects;
create policy "Users replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- 20261001100100_push.sql
-- Push notifications (GP-017)
create table if not exists public.push_tokens (
  token text primary key
    constraint push_token_format check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

alter table public.notifications add column if not exists pushed_at timestamptz;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (
  key text primary key,
  value text not null
);
-- Not reachable through the API anyway; RLS with no policies is a second lock. The trigger
-- function runs as the table owner, which RLS doesn't apply to.
alter table private.settings enable row level security;
revoke all on private.settings from public, anon, authenticated;

create extension if not exists pg_net with schema extensions;

create or replace function public.push_new_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
begin
  select value into url from private.settings where key = 'push_function_url';
  if url is null or url = '' then
    return null;
  end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;

revoke execute on function public.push_new_notification() from public, anon, authenticated;

create or replace trigger notifications_push after insert on public.notifications
  for each row execute function public.push_new_notification();

-- ---------------------------------------------------------------- record as applied
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('20261001100000', 'avatars', '{}'),
  ('20261001100100', 'push', '{}')
on conflict (version) do nothing;

-- ---------------------------------------------------------------- staging: where pushes go
insert into private.settings (key, value)
values ('push_function_url', 'https://priumjuvygdulevqxkza.supabase.co/functions/v1/push')
on conflict (key) do update set value = excluded.value;

commit;
