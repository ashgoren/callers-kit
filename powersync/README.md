# PowerSync

Config for the PowerSync Cloud instance that syncs the app's Supabase Postgres data to a local SQLite database on each client, enabling offline reads/writes.

## Files

- `service.yaml` — instance configuration: the Supabase Postgres connection (as `powersync_role`) and client auth (validates Supabase Auth JWTs). Tracked in git; secrets are referenced via `!env`, never inlined.
- `sync-config.yaml` — Sync Streams: which rows replicate to which signed-in user.
- `cli.yaml` — link file tying this directory to the PowerSync Cloud instance (written by `powersync link`/`pull instance`).
- `.env` (gitignored) — secret values referenced by `service.yaml`'s `!env` tags, e.g. `POWERSYNC_DATABASE_PASSWORD`.

Managed via the [PowerSync CLI](https://docs.powersync.com/tools/cli) (`npm install -g powersync`), run from the repo root.

## Environment variables aren't auto-loaded

The `powersync` CLI does **not** read `.env` files automatically — there's no `--env-file` flag on `validate`/`deploy`/etc. `!env FOO` in the YAML resolves against the real shell environment only. So `.env` here is a place to *record* secret values (and the source other tooling reads from), not something the CLI loads on its own.

Before running any `powersync` command that touches `service.yaml` (`validate`, `deploy`, `deploy service-config`), export the values first:

```sh
set -a && source powersync/.env && set +a
powersync validate
```

## Currently in use

Only the **Production** instance is provisioned/deployed — a deliberate choice, not an oversight. Since this app has no real users yet and both a "Development" and "Production" PowerSync instance would replicate from the same single Supabase Postgres database, running two instances would just double the replication-slot overhead (relevant given Supabase's known WAL-growth issue with idle logical replication slots) without any actual data isolation benefit. Revisit this once real users depend on the app being stable — that's when a separate instance to test sync-config changes against starts paying for itself.
