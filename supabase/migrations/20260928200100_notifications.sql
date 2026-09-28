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
