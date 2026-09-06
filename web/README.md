# Caller's Kit — Web

Vite + React 19 + TypeScript, with Tailwind v4 and shadcn/ui.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **shadcn/ui** components (`src/components/ui`), path-aliased via `@/*`
- **ESLint** + `typescript-eslint` (type-aware, via `projectService`), `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **React Compiler**, enabled via `@vitejs/plugin-react`'s native `compiler: true` option

## Scripts

```sh
pnpm dev       # start dev server
pnpm build     # typecheck (tsc -b) + production build
pnpm lint      # eslint .
pnpm preview   # preview a production build
```

## Linting

ESLint runs with type-aware rules enabled (`tseslint.configs.recommendedTypeChecked`), which catches issues plain `tsc` doesn't flag as type errors — e.g. `no-floating-promises`, `no-misused-promises`. Config lives in `eslint.config.js`.

`src/components/ui/**` is exempted from `react-refresh/only-export-components` — shadcn generates components that co-locate variant helpers (e.g. `buttonVariants`) with the component export, which is vendored code, not ours to restructure.

## React Compiler

Enabled via `react({ compiler: true })` in `vite.config.ts`, which runs the transform through `oxc-transform-react` (the Rust/Oxc-based implementation, not Babel — `@vitejs/plugin-react` v6 no longer uses Babel by default). This is the officially supported path for this plugin version, though the `compiler` option itself is still marked `@experimental` upstream. `eslint-plugin-react-hooks` v7 (already installed) bundles the compiler-readiness lint rules (`purity`, `immutability`, `set-state-in-render`, `preserve-manual-memoization`, etc.), so compiler-safe patterns are already enforced by `pnpm lint`.
