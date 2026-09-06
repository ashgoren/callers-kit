-- Enable realtime for user-owned tables.
-- Join tables are not included due to lack of user_id scoping — their changes are handled by invalidating parent table queries.
ALTER PUBLICATION supabase_realtime ADD TABLE dances, programs, choreographers;
