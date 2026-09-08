# PowerSync

Config for the PowerSync Cloud instance that syncs the app's Supabase Postgres data to a local SQLite database on each client, enabling offline reads/writes.

## Files

- `service.yaml` - instance configuration: the Supabase Postgres connection (as `powersync_role`) and client auth (validates Supabase Auth JWTs). Tracked in git; secrets are referenced via `!env`, never inlined.
- `sync-config.yaml` - Sync Streams: which rows replicate to which signed-in user.
- `cli.yaml` - link file tying this directory to the PowerSync Cloud instance (written by `powersync link`/`pull instance`).
- `.env` (gitignored) - secret values referenced by `service.yaml`'s `!env` tags, e.g. `POWERSYNC_DATABASE_PASSWORD`.

Managed via the [PowerSync CLI](https://docs.powersync.com/tools/cli) (`npm install -g powersync`), run from the repo root.

## Environment variables aren't auto-loaded

The `powersync` CLI does **not** read `.env` files automatically - there's no `--env-file` flag on `validate`/`deploy`/etc. `!env FOO` in the YAML resolves against the real shell environment only. So `.env` here is a place to *record* secret values, not something the CLI loads on its own.

Before running any `powersync` command that touches `service.yaml` (`validate`, `deploy`, `deploy service-config`), export the values first:

```sh
set -a && source powersync/.env && set +a
powersync validate
```

## Currently in use

Only the **Production** instance is provisioned/deployed. See `supabase/README.md` for the WAL-growth mitigation applied on the Postgres side for logical replication.

Auth: CLI is authenticated via a stored Cloud personal access token (`powersync login`), not `PS_ADMIN_TOKEN`.

## What's actually synced

`sync-config.yaml` defines seven streams, all auto-subscribed: `dances` (`SELECT *`, scoped per-user via `WHERE dances.user_id = auth.user_id()`); `choreographers`, `key_moves`, and `vibes` (same per-user pattern, each with its own `user_id` column); and `dances_choreographers`, `dances_key_moves`, and `dances_vibes` (junction tables with no `user_id` of their own - each scoped via a join to the owning dance's `user_id` instead). `programs` is not yet synced. `dance_type`/`formation`/`progression` are plain enum columns on `dances` itself (not a joined lookup table), so they have no stream of their own.

**Stream queries use full table names, never aliases** - PowerSync attributes synced rows to whatever name follows `FROM`, so an alias there makes it sync rows under that alias's name instead of the real table name, breaking the client schema mapping. `powersync validate` catches this.
