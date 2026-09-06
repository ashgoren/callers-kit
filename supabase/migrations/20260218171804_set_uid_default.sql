ALTER TABLE dances ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE programs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE choreographers ALTER COLUMN user_id SET DEFAULT auth.uid();