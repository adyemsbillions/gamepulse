-- GamePulse core schema (GP-010)
-- Mirrors src/lib/types.ts. Naming: snake_case columns, *_count for denormalised counters
-- (kept correct by triggers in the counters migration, never written by clients).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums

create type public.reel_status as enum ('uploading', 'processing', 'ready', 'published', 'removed');
create type public.notification_type as enum ('cheer', 'comment', 'new_fan', 'mention', 'replay', 'system');
create type public.report_reason as enum ('spam', 'abuse', 'violence', 'nudity', 'hate', 'copyright', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.user_role as enum ('user', 'moderator', 'admin');

-- ---------------------------------------------------------------- helpers

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint username_format check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null default ''
    constraint display_name_length check (char_length(display_name) <= 50),
  bio text not null default ''
    constraint bio_length check (char_length(bio) <= 160),
  avatar_url text,
  country text not null default '',
  country_flag text not null default '',
  favorite_club text not null default '',
  onboarded boolean not null default false,
  verified boolean not null default false,
  role public.user_role not null default 'user',
  fans_count integer not null default 0,        -- people supporting this user
  supporting_count integer not null default 0,  -- people this user supports
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile is created for every new auth user. Username is a placeholder until onboarding.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'fan_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role check used by policies. SECURITY DEFINER so it can read profiles regardless of RLS.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- ---------------------------------------------------------------- reels

create table public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null default ''
    constraint caption_length check (char_length(caption) <= 2200),
  status public.reel_status not null default 'uploading',
  video_provider text,           -- e.g. 'bunny', 'mux', 'cloudflare'
  video_asset_id text,           -- the provider's id for this video
  playback_url text,
  thumbnail_url text,
  duration_sec numeric(6, 2),
  cheers_count integer not null default 0,
  comments_count integer not null default 0,
  replays_count integer not null default 0,
  shares_count integer not null default 0,
  views_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index reels_published_idx on public.reels (published_at desc) where status = 'published';
create index reels_user_idx on public.reels (user_id, created_at desc);
create unique index reels_video_asset_idx on public.reels (video_provider, video_asset_id)
  where video_asset_id is not null;

create trigger reels_touch before update on public.reels
  for each row execute function public.touch_updated_at();

-- Stamp published_at the first time a reel is published.
create or replace function public.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger reels_stamp_published before insert or update of status on public.reels
  for each row execute function public.stamp_published_at();

-- ---------------------------------------------------------------- hashtags

create table public.hashtags (
  name text primary key
    constraint hashtag_format check (name ~ '^[a-z0-9_]{1,50}$'),
  usage_count integer not null default 0,
  trending_score double precision not null default 0,
  created_at timestamptz not null default now()
);

create index hashtags_trending_idx on public.hashtags (trending_score desc);

create table public.reel_hashtags (
  reel_id uuid not null references public.reels (id) on delete cascade,
  tag text not null references public.hashtags (name) on delete cascade,
  primary key (reel_id, tag)
);

create index reel_hashtags_tag_idx on public.reel_hashtags (tag);

-- Tagging a reel creates the hashtag if it's new, so clients never write `hashtags` directly.
create or replace function public.ensure_hashtag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.tag := lower(new.tag);
  insert into public.hashtags (name) values (new.tag) on conflict (name) do nothing;
  return new;
end;
$$;

create trigger reel_hashtags_ensure before insert on public.reel_hashtags
  for each row execute function public.ensure_hashtag();

-- ---------------------------------------------------------------- comments

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null
    constraint body_length check (char_length(btrim(body)) between 1 and 500),
  cheers_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index comments_reel_idx on public.comments (reel_id, created_at desc);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;

-- A reply must belong to the same reel as the comment it answers.
create or replace function public.check_reply_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments p where p.id = new.parent_id and p.reel_id = new.reel_id
  ) then
    raise exception 'Reply parent must be a comment on the same reel' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger comments_check_parent before insert on public.comments
  for each row execute function public.check_reply_parent();

-- ---------------------------------------------------------------- engagement

create table public.cheers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid not null references public.reels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);
create index cheers_reel_idx on public.cheers (reel_id);

create table public.comment_cheers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
create index comment_cheers_comment_idx on public.comment_cheers (comment_id);

create table public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid not null references public.reels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);

create table public.replays (
  user_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid not null references public.reels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);
create index replays_reel_idx on public.replays (reel_id);

-- "Support" = follow. supporter_id supports creator_id; the creator gains a fan.
create table public.supports (
  supporter_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supporter_id, creator_id),
  constraint no_self_support check (supporter_id <> creator_id)
);
create index supports_creator_idx on public.supports (creator_id);

-- ---------------------------------------------------------------- notifications

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles (id) on delete cascade,
  reel_id uuid references public.reels (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  body text,                      -- only for 'system' messages and comment previews
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where not read;

-- ---------------------------------------------------------------- reports

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid references public.reels (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text not null default ''
    constraint details_length check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_has_target check (num_nonnulls(reel_id, comment_id, reported_user_id) >= 1)
);

create index reports_open_idx on public.reports (created_at) where status = 'open';
