# Caller's Kit — Web

Vite + React 19 + TypeScript, with Tailwind v4 and shadcn/ui.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **shadcn/ui** components (`src/components/ui`), path-aliased via `@/*`
- **ESLint** + `typescript-eslint` (type-aware, via `projectService`), `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **React Compiler**, enabled via `@vitejs/plugin-react`'s native `compiler: true` option
- **Supabase Auth** (`@supabase/supabase-js`) + **react-router** (data-router mode) for auth/routing

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

ESLint runs with type-aware rules enabled (`tseslint.configs.recommendedTypeChecked`), which catches issues plain `tsc` doesn't flag as type errors — e.g. `no-floating-promises`, `no-misused-promises`. Config lives in `eslint.config.js`.

`src/components/ui/**` is exempted from `react-refresh/only-export-components` — shadcn generates components that co-locate variant helpers (e.g. `buttonVariants`) with the component export, which is vendored code, not ours to restructure.

## React Compiler

Enabled via `react({ compiler: true })` in `vite.config.ts`, which runs the transform through `oxc-transform-react` (the Rust/Oxc-based implementation, not Babel — `@vitejs/plugin-react` v6 no longer uses Babel by default). This is the officially supported path for this plugin version, though the `compiler` option itself is still marked `@experimental` upstream. `eslint-plugin-react-hooks` v7 (already installed) bundles the compiler-readiness lint rules (`purity`, `immutability`, `set-state-in-render`, `preserve-manual-memoization`, etc.), so compiler-safe patterns are already enforced by `pnpm lint`.

## Auth

Points at the hosted Supabase project (not local dev) — see `.env.local` (gitignored; contains only the public `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, not secrets).

- `src/lib/supabase.ts` — the Supabase client, using default session persistence (`localStorage` + `autoRefreshToken`). This is what makes the app usable offline once signed in: the client's session survives without network, and `AuthContext`'s `user` state is only cleared by an explicit sign-out or a definitively invalid session — never merely by a failed token refresh while offline.
- `src/contexts/AuthContext.tsx` — exposes `user`, `authLoading`, `signIn`, `signUp`, `resetPassword`, `signOut`.
- `src/routes/auth/` — `SignInPage`, `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage` (all sharing the `AuthShell` layout), each with its zod schema in a sibling `*.schema.ts` file (kept separate from the component so both stay independently importable — a schema imported into a test file would otherwise trip `react-refresh/only-export-components` on the component file). `src/routes/ProtectedRoute.tsx` (top-level, not under `auth/` — it gates every protected route, not just auth-specific ones) is a layout route checking `authLoading`/`user`, redirecting to `/signin` via `<Navigate>`. Built with Tailwind/shadcn and React 19's `useActionState` + zod.
- `src/routes/AppShell.tsx` — the signed-in app's persistent chrome (header with a user menu: email + sign out), nested inside `ProtectedRoute`'s children rather than merged into it — `ProtectedRoute` stays focused on the auth gate and PowerSync connection, `AppShell` on page layout. Every protected route renders inside it via `<Outlet />`.
- The hosted Supabase project's **Authentication → URL Configuration → Redirect URLs** must include the dev origin (e.g. `http://localhost:5173/**`) alongside the production URL, or confirmation/reset-password email links will redirect to the wrong place.
- `signUp()` intentionally returns success with no error — and sends no email — when called with an already-registered, confirmed email. This is Supabase's built-in anti-enumeration protection, not a bug.

## PowerSync (offline sync)

`src/lib/powersync/` — see `powersync/README.md` (repo root) for the service-side config this connects to.

- `schema.ts` — the local SQLite client schema. Deliberately not a 1:1 mirror of the Postgres schema; only columns the app actually reads/writes locally need to be declared here. `dance_type`/`formation`/`progression` are Postgres enum columns represented as plain `column.text` locally — no separate lookup table or sync stream, since the value lives directly on the `dances` row (see `powersync/README.md`).
- `connector.ts` — `SupabaseConnector`, implementing `fetchCredentials()` (hands PowerSync the current Supabase session's access token) and `uploadData()` (replays the local write queue as `supabase-js` calls, going through the same RLS-protected path any normal client call uses). Note: `supabase-js` doesn't throw on failure — it returns `{ error }` — so every branch explicitly checks and throws, or a failed write would silently vanish from the upload queue instead of retrying.
- `database.ts` — the `db` singleton (`PowerSyncDatabase` instance), created once at module scope, not inside a component/`useEffect` — doing that instead breaks sync under React Strict Mode's dev-only double-mount (the first mount's cleanup tears down the shared worker before the second mount can use it). Uses `OPFSCoopSyncVFS` rather than the `IDBBatchAtomicVFS` default — faster, avoids a known IndexedDB-VFS crash on large Safari queries, and is PowerSync's own recommended VFS for Safari/iOS multi-tab support specifically (relevant since iPad is a real target). No fallback to `IDBBatchAtomicVFS` for Safari Private Browsing (the one case OPFS doesn't support) is implemented yet.
- `PowerSyncProvider.tsx` — wraps `ProtectedRoute`'s children, providing `db` via `@powersync/react`'s `PowerSyncContext` and calling `db.connect()` exactly once, only after `AuthContext`'s `user` resolves (never on load for a signed-out visitor).
- `commitFieldEdit.ts` — the single chokepoint for field-level writes (`db.execute('UPDATE ...')`). `table`/`column` args are trusted, hardcoded identifiers our own components pass in, never user input — SQL placeholders only parameterize values, not identifiers.
- `VITE_POWERSYNC_URL` in `.env.local`/`.env.example` — the PowerSync instance URL. Safe to expose client-side, same as the Supabase URL/publishable key — the security boundary is the JWT presented on connect, not obscurity of the endpoint.

**`vite.config.ts` note:** PowerSync's own SDK docs say to install `vite-plugin-wasm` + `vite-plugin-top-level-await`, but Vite 8 does not require them. Vite 8 has native WASM import and top-level-await support built in. `optimizeDeps.exclude` for `@journeyapps/wa-sqlite`/`@powersync/web` and `worker: { format: 'es' }` are still needed (the SQLite engine runs in a worker and doesn't survive esbuild's dependency pre-bundling).

**Editing pattern:** `EditableDanceTitle` in `HomePage.tsx` is a first, deliberately one-off cut of blur-save field editing (click text → becomes an input → commits via `commitFieldEdit` on blur/Enter) — not yet the generalized, reusable field-type component (`EditableTextField` etc., parameterized by table/column) the rest of the app's editing UI will eventually use. No validation or undo yet either — both land in later phases.

## Testing

**Vitest** (`pnpm test` / `pnpm test:watch`) — unit tests, colocated next to source. `vite.config.ts` splits tests by extension: plain `*.test.ts` files run under a `node` project (no DOM needed, faster), while `*.test.tsx` files run under a `jsdom` project with React Testing Library, via a shared `src/test-setup.ts`. Coverage spans pure logic (SQL/param generation, zod schema validation), Supabase/PowerSync integration points (upload-queue error handling, connect/auth-state wiring), and component behavior (auth state transitions, protected-route redirect logic) — each test file's own comments document the specific cases and why they matter.

**Playwright** (`pnpm test:e2e`, Chromium only for now) — real end-to-end tests, covering the offline-edit sync round-trip, the sign-up form's wiring to the real Supabase endpoint, and the unauthenticated `/` → `/signin` redirect. Each spec's own comments document its specific scenario and why it's structured that way. Runs against a dedicated test account, not a real one — `e2e/.env` (gitignored) holds its email/password and seeded test data. `playwright.config.ts` reuses an already-running `pnpm dev` on `localhost:5173` instead of fighting over the port (common locally, since you're usually already running it) — only spawns a fresh server in CI, where nothing's running yet. It loads `.env.local` and `e2e/.env` via Node's built-in `process.loadEnvFile()`, since Playwright's config/tests run in plain Node, not through Vite (`import.meta.env` isn't available there).
