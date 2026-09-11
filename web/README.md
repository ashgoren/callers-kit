# Caller's Kit - Web

Vite + React 19 + TypeScript, with Tailwind v4 and shadcn/ui.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **shadcn/ui** components (`src/components/ui`), path-aliased via `@/*`
- **ESLint** + `typescript-eslint` (type-aware, via `projectService`), `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **React Compiler**, enabled via `@vitejs/plugin-react`'s native `compiler: true` option
- **Supabase Auth** (`@supabase/supabase-js`) + **react-router** (data-router mode) for auth/routing
- **TanStack Table v9** (`@tanstack/react-table`) for the Dances table
- **date-fns** for date formatting

## Scripts

```sh
pnpm dev        # start dev server
pnpm build      # typecheck (tsc -b) + production build
pnpm typecheck  # tsc -b only, no build
pnpm lint       # eslint .
pnpm test       # vitest run (unit tests, single pass)
pnpm test:watch # vitest, interactive watch mode
pnpm test:e2e   # playwright test
pnpm preview    # preview a production build
```

## Linting

ESLint runs with type-aware rules enabled (`tseslint.configs.recommendedTypeChecked`), which catches issues plain `tsc` doesn't flag as type errors - e.g. `no-floating-promises`, `no-misused-promises`. Config lives in `eslint.config.js`.

`src/components/ui/**` is exempted from `react-refresh/only-export-components` - shadcn generates components that co-locate variant helpers (e.g. `buttonVariants`) with the component export.

## React Compiler

Enabled via `react({ compiler: true })` in `vite.config.ts`, which runs the transform through `oxc-transform-react` (the Rust/Oxc-based implementation; `@vitejs/plugin-react` v6 uses Babel no longer). `eslint-plugin-react-hooks` v7 bundles the compiler-readiness lint rules (`purity`, `immutability`, `set-state-in-render`, `preserve-manual-memoization`, etc.), enforced by `pnpm lint`.

## Theming

`src/contexts/ThemeContext.tsx` - light/dark/system, hand-rolled. Persisted to `localStorage` (per-device). Applies/removes the `dark` class on `<html>`, which is what shadcn's `@custom-variant dark` line in `index.css` keys off. A small inline script in `index.html` applies the saved/system theme before React mounts. The control lives in `AppShell`'s user menu.

## Auth

Points at the hosted Supabase project (not local dev) - see `.env.local` (gitignored; contains only the public `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, not secrets).

- `src/lib/supabase.ts` - the Supabase client, using default session persistence (`localStorage` + `autoRefreshToken`). The client's session survives without network, and `AuthContext`'s `user` state is only cleared by an explicit sign-out or a definitively invalid session - never merely by a failed token refresh while offline.
- `src/contexts/AuthContext.tsx` - exposes `user`, `authLoading`, `signIn`, `signUp`, `resetPassword`, `signOut`.
- `src/routes/auth/` - `SignInPage`, `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage` (all sharing the `AuthShell` layout), each with its own zod schema in a sibling `*.schema.ts` file. `src/routes/ProtectedRoute.tsx` (top-level, not under `auth/` - it gates every protected route) is a layout route checking `authLoading`/`user`, redirecting to `/signin` via `<Navigate>`. Built with Tailwind/shadcn and React 19's `useActionState` + zod.
- `src/routes/AppShell.tsx` - the signed-in app's persistent chrome (header with a user menu: email + sign out), nested inside `ProtectedRoute`'s children. Every protected route renders inside it via `<Outlet />`. `/` (the index route) is `<Navigate to="/dances" replace>`. The `<Outlet />` itself is gated on `useStatus().hasSynced` (from `@powersync/react`) - until PowerSync's initial full sync completes, it shows a loading spinner instead of routing to a page, since no route has any real content to show before that anyway. That spinner starts alone (covers the brief, normal moment `hasSynced` takes to resolve from local state on every page load, even on an already-synced device) and only gains a more detailed "this can take up to a minute on a new device…" explanation alongside it once loading has actually continued for a few seconds - which only happens for a genuinely slow first sync or a real connection problem. The header/user menu stay visible and usable throughout, since this gate lives below the header, not in `PowerSyncProvider` (which wraps the whole route subtree).
- The hosted Supabase project's **Authentication → URL Configuration → Redirect URLs** must include the dev origin (e.g. `http://localhost:5173/**`) alongside the production URL, or confirmation/reset-password email links redirect to the wrong place.
- `signUp()` returns success with no error - and sends no email - when called with an already-registered, confirmed email. This is Supabase's built-in anti-enumeration protection, not a bug.

## PowerSync (offline sync)

`src/lib/powersync/` - see `powersync/README.md` (repo root) for the service-side config this connects to.

- `schema.ts` - the local SQLite client schema. Not a 1:1 mirror of the Postgres schema - only columns the app actually reads/writes locally are declared here. `dance_type`/`formation`/`progression` are Postgres enum columns represented as plain `column.text` locally (see `powersync/README.md`). `choreographers`/`dances_choreographers`, `key_moves`/`dances_key_moves`, and `vibes`/`dances_vibes` are declared here too, for the Dances table's tag-style join columns (see Dances below).
- `connector.ts` - `SupabaseConnector`, implementing `fetchCredentials()` (hands PowerSync the current Supabase session's access token) and `uploadData()` (replays the local write queue as `supabase-js` calls, going through the same RLS-protected path any normal client call uses). `supabase-js` doesn't throw on failure - it returns `{ error }` - so every branch explicitly checks and throws.
- `database.ts` - the `db` singleton (`PowerSyncDatabase` instance), created once at module scope. Uses `OPFSCoopSyncVFS`. No fallback to `IDBBatchAtomicVFS` for private/incognito browsing (the one case OPFS doesn't support, in most non-Chromium browsers) yet.
- `PowerSyncProvider.tsx` - wraps `ProtectedRoute`'s children, providing `db` via `@powersync/react`'s `PowerSyncContext` and calling `db.connect()` once `AuthContext`'s `user` resolves. `connect()`'s own promise can't detect a broken local database (PowerSync swallows connection errors internally to retry silently), so `db.waitForReady()` is awaited alongside it - that's the one that actually rejects when the local SQLite database itself fails to open. That failure is always local (never a network blip) and can't be retried in place on the same page (`db`'s internal ready-promise is cached forever once rejected), so the error UI reloads the page instead of retrying.
- `commitFieldEdit.ts` - the single chokepoint for field-level writes (`db.execute('UPDATE ...')`). `table`/`column` args are trusted, hardcoded identifiers our own components pass in, never user input - SQL placeholders only parameterize values, not identifiers.
- `VITE_POWERSYNC_URL` in `.env.local`/`.env.example` - the PowerSync instance URL. Safe to expose client-side, same as the Supabase URL/publishable key.

**`vite.config.ts` note:** Vite 8 has native WASM import and top-level-await support built in. `optimizeDeps.exclude` for `@journeyapps/wa-sqlite`/`@powersync/web` and `worker: { format: 'es' }` are needed (the SQLite engine runs in a worker and doesn't survive esbuild's dependency pre-bundling).

## Dances

`src/routes/DancesPage.tsx` (route: `/dances`, redirected to from `/`) - a read-only render (`title`, `difficulty`, `formation`, `choreographers`, `key_moves`, `vibes`, `notes`, `created_at`, `updated_at`); no editing, sorting, or column reordering/hiding yet. Two presentations sharing one query: a real `<Table>` at `sm:` (640px+) and up - and a stacked card list below that, for phone widths. Dates render compact (`date-fns`'s `format(value, 'M/d/yy')`); notes are truncated with a `title`-attribute tooltip; the tag-style join columns (choreographers, key_moves, vibes) are not truncated.

Split into three sibling files: `DancesPage.columns.tsx` (column definitions + formatting helpers), `DancesPage.data.ts` (the `useDances()` hook - the query and its data-shaping logic), and `DancesPage.tsx` itself (layout).

`choreographers`, `key_moves`, and `vibes` are not columns on `dances` itself - `useDances()`'s query adds each via its own correlated `json_group_array(...)` subquery (over `dances_choreographers`/`choreographers`, `dances_key_moves`/`key_moves`, and `dances_vibes`/`vibes` respectively), parsed client-side into a `string[]`. This result type (`DanceWithJoins`, in `DancesPage.columns.tsx`) is separate from the base `Dance` type.

Built with TanStack Table v9's `useTable` API (`features: tableFeatures({...})`, `table.FlexRender`). `tableFeatures({})` is currently empty.

**Editing** isn't built yet - `title` and every other field here are read-only. That lands with a dedicated detail view in a later phase.

## Deployment

Deployed to Vercel. The repo root isn't the Vite app - the Vercel project's **Settings → General → Root Directory** is set to `web`, and `vercel` CLI commands (`vercel link`, `vercel env`, etc.) must be run from inside `web/`, not the repo root. Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_POWERSYNC_URL`) are configured directly in Vercel (dashboard or `vercel env add`), not GitHub Secrets.

**Env vars are Production-scoped only** - a Preview deployment (e.g. from a non-`main` branch) will build successfully but fail to reach Supabase/PowerSync at runtime, since Vite bakes these in at build time from whatever scope the build environment provides. Add Preview scope (`vercel env add <name> preview`, same values as Production).

## Testing

**Vitest** (`pnpm test` / `pnpm test:watch`) - unit tests, colocated next to source. `vite.config.ts` splits tests by extension: plain `*.test.ts` files run under a `node` project (no DOM needed, faster), while `*.test.tsx` files run under a `jsdom` project with React Testing Library, via a shared `src/test-setup.ts`. Each test file's own name and comments document what it covers.

**Playwright** (`pnpm test:e2e`, Chromium only for now) - end-to-end tests. Runs against a dedicated test account, not a real one - `e2e/.env` (gitignored) holds its credentials and seeded fixture data (durable across runs, not created/cleaned up per test). `playwright.config.ts` reuses an already-running `pnpm dev` on `localhost:5173`; only spawns a fresh server in CI. It loads `.env.local` and `e2e/.env` via Node's built-in `process.loadEnvFile()`, since Playwright's config/tests run in plain Node, not through Vite. Flows requiring a real inbox (email confirmation, the reset-password page reached via an emailed link) aren't covered here.
