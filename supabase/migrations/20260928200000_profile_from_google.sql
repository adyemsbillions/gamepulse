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
