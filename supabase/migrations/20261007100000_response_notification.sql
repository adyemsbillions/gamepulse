-- Duets: someone responded to your Moment with one of theirs.
-- Kept in its own migration: a new enum value can't be used in the transaction that adds it.
alter type public.notification_type add value if not exists 'response';
