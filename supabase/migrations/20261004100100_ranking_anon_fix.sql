-- Fix for 20261004100000_ranking.sql: signed-out visitors got "permission denied for table
-- hidden_reels" from hot_reels. Postgres checks table privileges for every table a query names,
-- even inside a branch that can't run for them (auth.uid() is null). Granting SELECT is safe:
-- both tables only have policies for signed-in owners, so anon still sees no rows.
grant select on public.hidden_reels, public.mutes to anon;
