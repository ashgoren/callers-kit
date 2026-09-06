-- Required for Supabase Realtime to filter DELETE events by user_id.
-- Without FULL, only the primary key is written to the WAL on delete,
-- so the user_id filter cannot be applied and delete events are dropped.
ALTER TABLE dances REPLICA IDENTITY FULL;
ALTER TABLE programs REPLICA IDENTITY FULL;
ALTER TABLE choreographers REPLICA IDENTITY FULL;
