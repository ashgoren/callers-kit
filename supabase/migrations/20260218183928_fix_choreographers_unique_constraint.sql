ALTER TABLE choreographers DROP CONSTRAINT choreographers_name_key;
ALTER TABLE choreographers ADD CONSTRAINT choreographers_name_user_key UNIQUE (name, user_id);