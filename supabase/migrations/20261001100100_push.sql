-- Push notifications (GP-017)
-- Each device registers an Expo push token for the signed-in user. Every new notification row is
-- handed to the `push` Edge Function (by id only), which sends it to the recipient's devices.
-- The function marks rows as pushed and ignores stale ones, so calling it can't spam anyone.

-- ---------------------------------------------------------------- device tokens

create table if not exists public.push_tokens (
  token text primary key
    constraint push_token_format check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- Only the RPCs below and the service role touch this table.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- A phone belongs to whoever signed in on it last: registering moves the token to you.
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

-- ---------------------------------------------------------------- sending

-- Set once a notification has been handed to the push service (so it's never sent twice).
alter table public.notifications add column if not exists pushed_at timestamptz;

-- Settings the database needs but the Data API must never expose.
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

-- Hand each new notification to the push function. Does nothing until the function's URL is set:
--   insert into private.settings values ('push_function_url', 'https://<ref>.supabase.co/functions/v1/push')
--   on conflict (key) do update set value = excluded.value;
-- pg_net sends the request after the transaction commits, so a slow push never slows a cheer.
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
