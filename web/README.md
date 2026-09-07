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
- `src/routes/` — `SignInPage`, `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage` (all sharing the `AuthShell` layout), plus `ProtectedRoute` (a layout route gating on `authLoading`/`user`, redirecting to `/signin` via `<Navigate>`). Built with Tailwind/shadcn and React 19's `useActionState` + zod.
- The hosted Supabase project's **Authentication → URL Configuration → Redirect URLs** must include the dev origin (e.g. `http://localhost:5173/**`) alongside the production URL, or confirmation/reset-password email links will redirect to the wrong place.
- `signUp()` intentionally returns success with no error — and sends no email — when called with an already-registered, confirmed email. This is Supabase's built-in anti-enumeration protection, not a bug.
