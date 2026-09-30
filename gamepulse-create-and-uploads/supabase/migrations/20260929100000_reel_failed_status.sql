-- Uploads (GP-018/020): a reel whose video could not be processed ends up 'failed'.
-- Kept in its own migration: a new enum value can't be used in the transaction that adds it.
alter type public.reel_status add value if not exists 'failed' after 'ready';
