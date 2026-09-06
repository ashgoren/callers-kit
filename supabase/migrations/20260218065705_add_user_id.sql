SET ROLE postgres;

-- Add user_id to main tables
ALTER TABLE dances ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE choreographers ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE programs ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Backfill test user ID
UPDATE dances SET user_id = '321eb8ee-d60b-4e0e-9b23-79ad81c1b380';
UPDATE choreographers SET user_id = '321eb8ee-d60b-4e0e-9b23-79ad81c1b380';
UPDATE programs SET user_id = '321eb8ee-d60b-4e0e-9b23-79ad81c1b380';

-- Make it required
ALTER TABLE dances ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE choreographers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE programs ALTER COLUMN user_id SET NOT NULL;