-- PowerSync connects to this database via logical replication as this role.
-- BYPASSRLS is required: PowerSync's own sync streams handle per-user scoping,
-- so this role must see all rows regardless of RLS policies.
--
-- No password is set here — it's set separately via a one-off ALTER ROLE
-- statement run directly in the SQL Editor, not tracked in git.
CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;

CREATE PUBLICATION powersync FOR ALL TABLES;
