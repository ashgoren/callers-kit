# Supabase

Postgres database, auth, and one edge function for Caller's Kit. Hosted project (not local dev) - see `.temp/project-ref` for the linked project ref, or run `supabase projects list`.

## Migrations

Schema is managed via `supabase/migrations/*.sql`, applied to the linked hosted project with:

```sh
supabase db push --linked
```

There's no local Postgres running for this project (no `supabase start`) - the hosted project is the only database in the picture, so migrations go straight there rather than through a local-first workflow.

## PowerSync integration

`powersync_role` (see the `add_powersync_role` migration) is the Postgres role PowerSync Cloud uses to replicate data via logical replication. It has `REPLICATION` + `BYPASSRLS` - it needs to see every row regardless of RLS, since per-user scoping is enforced by PowerSync's own sync streams instead (see `powersync/README.md`). Its password is set out-of-band via the SQL Editor, not tracked in any migration.

**WAL growth mitigation**: `max_wal_size` and `max_slot_wal_keep_size` are both set to `1GB` via `postgres-config update` (not part of a migration - these are project-level Postgres config, not schema). This follows PowerSync's own documented guidance for pet/hobby projects, addressing a known issue where idle logical replication slots cause excessive WAL growth on Supabase. Check current values with:

```sh
supabase postgres-config get --project-ref <ref> --experimental
```

## Data API access (grants + RLS)

Supabase is deprecating auto-exposed Data API access for `public` tables - enforced on all existing projects from October 30, 2026: tables without explicit `GRANT` statements will stop being reachable via `supabase-js`/PostgREST entirely. Checked (2026-09-06): every table already has explicit `grant` statements from the baseline migration, and the share-page RPCs (`get_shared_dance`/`get_shared_program`) already have `GRANT EXECUTE ... TO anon`. Nothing to do here - just worth having on record. This matters for more than just direct client calls: PowerSync's write path (`uploadData` → `supabase-js`) goes through this same Data API, so a table missing a grant would silently break offline writes for that table, not just direct app queries.

## Edge function

`functions/callers-box` - imports a dance from [Caller's Box](https://www.ibiblio.org/contradance/thecallersbox/dance.php). A normal authenticated HTTP endpoint, not synced data - unaffected by the PowerSync/offline architecture.
