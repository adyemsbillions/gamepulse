-- ============================================================================================
-- Manual apply for when `npx supabase db push` can't reach the database.
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once. It also records both migrations as applied, so a later
-- `npx supabase db push` won't try to run them again.
-- ============================================================================================

begin;

-- ---------------------------------------------------------------- 20260928200000_profile_from_google.sql
-- Profiles created from Google sign-in (GP-012)
-- Carry the Google display name and photo into the new profile. Username stays a placeholder
-- (fan_xxxx) until the user picks one during onboarding.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'fan_' || substr(replace(new.id::text, '-', ''), 1, 12),
    left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 50),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- 20260928200100_notifications.sql
-- Notifications from activity (GP-016)
-- Cheers, comments, replays, new fans and @mentions create a notification for the person they
-- concern. Nobody is notified about their own actions, and repeat cheer/replay taps on the same
-- reel within a day don't pile up.

create or replace function public.notify_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  mentioned record;
begin
  if tg_table_name = 'supports' then
    insert into public.notifications (recipient_id, type, actor_id)
    values (new.creator_id, 'new_fan', new.supporter_id);
    return null;
  end if;

  select r.user_id into owner from public.reels r where r.id = new.reel_id;
  if owner is null then
    return null;
  end if;

  if tg_table_name = 'comments' then
    if owner <> new.user_id then
      insert into public.notifications (recipient_id, type, actor_id, reel_id, comment_id)
      values (owner, 'comment', new.user_id, new.reel_id, new.id);
    end if;

    -- @mentions: anyone named in the comment other than the author and the reel owner
    -- (who already got a comment notification).
    for mentioned in
      select distinct p.id
      from regexp_matches(new.body, '@([a-z0-9_.]{3,24})', 'g') as m(name)
      join public.profiles p on p.username = m.name[1]
      where p.id <> new.user_id and p.id <> owner
      limit 10
    loop
      insert into public.notifications (recipient_id, type, actor_id, reel_id, comment_id)
      values (mentioned.id, 'mention', new.user_id, new.reel_id, new.id);
    end loop;
    return null;
  end if;

  -- cheers and replays
  if owner = new.user_id then
    return null;
  end if;
  if exists (
    select 1 from public.notifications n
    where n.recipient_id = owner
      and n.actor_id = new.user_id
      and n.reel_id = new.reel_id
      and n.type = (case tg_table_name when 'cheers' then 'cheer' else 'replay' end)::public.notification_type
      and n.created_at > now() - interval '1 day'
  ) then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, actor_id, reel_id)
  values (
    owner,
    (case tg_table_name when 'cheers' then 'cheer' else 'replay' end)::public.notification_type,
    new.user_id,
    new.reel_id
  );
  return null;
end;
$$;

create or replace trigger cheers_notify after insert on public.cheers
  for each row execute function public.notify_activity();
create or replace trigger replays_notify after insert on public.replays
  for each row execute function public.notify_activity();
create or replace trigger comments_notify after insert on public.comments
  for each row execute function public.notify_activity();
create or replace trigger supports_notify after insert on public.supports
  for each row execute function public.notify_activity();

revoke execute on function public.notify_activity() from public, anon, authenticated;

-- Welcome message for every new account.
create or replace function public.welcome_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, body)
  values (new.id, 'system', 'Welcome to GamePulse! Support GameMakers you rate to shape your Supporting feed.');
  return null;
end;
$$;

create or replace trigger profiles_welcome after insert on public.profiles
  for each row execute function public.welcome_new_profile();

revoke execute on function public.welcome_new_profile() from public, anon, authenticated;

-- ---------------------------------------------------------------- record as applied
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('20260928200000', 'profile_from_google', '{}'),
  ('20260928200100', 'notifications', '{}')
on conflict (version) do nothing;

commit;
