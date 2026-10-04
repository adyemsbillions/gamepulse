-- Rate limits (GP-038)
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
