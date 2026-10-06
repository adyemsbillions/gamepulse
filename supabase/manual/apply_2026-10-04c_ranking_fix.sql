-- ============================================================================================
-- Paste into Supabase Dashboard → SQL Editor → New query → Run. Safe to run more than once.
-- Fixes Hot Now for signed-out visitors ("permission denied for table hidden_reels").
-- ============================================================================================

begin;

grant select on public.hidden_reels, public.mutes to anon;

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261004100100', 'ranking_anon_fix', '{}')
on conflict (version) do nothing;

commit;
