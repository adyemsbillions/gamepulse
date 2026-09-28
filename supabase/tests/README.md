# Database tests

`access_rules.test.sql` checks the access rules and counters: who can read and write what,
which columns clients can never touch, and that counts stay correct on insert and delete.

Run it against a **local** database only — it creates test users in `auth.users`.

```bash
npx supabase start          # local Supabase in Docker
npx supabase db reset       # applies every migration in supabase/migrations
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/access_rules.test.sql
```

A clean run prints `ALL TESTS PASSED`. Any failure stops with `FAILED: <what broke>`.
Run `npx supabase db reset` again before re-running, so the fixture users don't collide.

## App queries

`api_smoke.test.ts` runs every read the app makes (`src/lib/data/supabase-source.ts`) against a
real API with seeded data: pagination, hashtag and creator filters, embedded creators and authors,
notification text, search, and private rows staying private. It expects a seeded local stack and
signs its own test tokens:

```bash
SUPABASE_TEST_URL=http://127.0.0.1:54321 JWT_SECRET=<local jwt secret> npx tsx supabase/tests/api_smoke.test.ts
```
