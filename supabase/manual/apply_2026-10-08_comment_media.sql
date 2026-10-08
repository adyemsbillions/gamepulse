-- ============================================================================================
-- Stickers and GIFs in comments. Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Safe to run more than once. Run it BEFORE the app update: that update reads the new columns.
-- ============================================================================================

begin;
-- Stickers and GIFs in comments
--
-- A comment can carry one sticker (GamePulse's own pack, bundled in the app: 'gp:<id>', or a GIPHY
-- sticker) or one GIF (from GIPHY's CDN). Text becomes optional when there's media. People can keep stickers and
-- GIFs they like in "My stickers" (saved_stickers), private to them.
-- Media URLs are checked against those two sources so comments can't point at arbitrary sites.

alter table public.comments add column if not exists media_kind text;
alter table public.comments add column if not exists media_url text;
alter table public.comments add column if not exists media_width integer;
alter table public.comments add column if not exists media_height integer;

alter table public.comments drop constraint if exists body_length;
alter table public.comments add constraint body_length
  check (char_length(body) <= 500 and (char_length(btrim(body)) >= 1 or media_url is not null));

alter table public.comments drop constraint if exists comment_media;
alter table public.comments add constraint comment_media check (
  (media_kind is null and media_url is null)
  or (media_kind = 'sticker' and (media_url ~ '^gp:[a-z0-9_]{1,40}$' or media_url ~ '^https://media[0-9]?\.giphy\.com/media/[A-Za-z0-9._/-]{1,200}$'))
  or (media_kind = 'gif' and media_url ~ '^https://media[0-9]?\.giphy\.com/media/[A-Za-z0-9._/-]{1,200}$')
);

grant insert (media_kind, media_url, media_width, media_height) on public.comments to authenticated;

-- ---------------------------------------------------------------- My stickers

create table if not exists public.saved_stickers (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  media_kind text not null,
  media_url text not null,
  media_width integer,
  media_height integer,
  created_at timestamptz not null default now(),
  primary key (user_id, media_url),
  constraint saved_sticker_media check (
    (media_kind = 'sticker' and (media_url ~ '^gp:[a-z0-9_]{1,40}$' or media_url ~ '^https://media[0-9]?\.giphy\.com/media/[A-Za-z0-9._/-]{1,200}$'))
    or (media_kind = 'gif' and media_url ~ '^https://media[0-9]?\.giphy\.com/media/[A-Za-z0-9._/-]{1,200}$')
  )
);

alter table public.saved_stickers enable row level security;
revoke all on public.saved_stickers from anon, authenticated;
grant select, delete on public.saved_stickers to authenticated;
grant insert (media_kind, media_url, media_width, media_height) on public.saved_stickers to authenticated;

drop policy if exists "Users see their stickers" on public.saved_stickers;
create policy "Users see their stickers"
  on public.saved_stickers for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users save stickers" on public.saved_stickers;
create policy "Users save stickers"
  on public.saved_stickers for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users remove stickers" on public.saved_stickers;
create policy "Users remove stickers"
  on public.saved_stickers for delete to authenticated
  using (user_id = (select auth.uid()));

-- Keep collections a sensible size.
create or replace function public.limit_saved_stickers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_stickers where user_id = new.user_id) >= 300 then
    raise exception using errcode = 'GP429', message = 'My stickers is full (300). Remove some to save more.';
  end if;
  return new;
end;
$$;
revoke execute on function public.limit_saved_stickers() from public, anon, authenticated;

create or replace trigger saved_stickers_limit before insert on public.saved_stickers
  for each row execute function public.limit_saved_stickers();

-- ---------------------------------------------------------------- record as applied
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261008100000', 'comment_media', '{}')
on conflict (version) do nothing;

commit;