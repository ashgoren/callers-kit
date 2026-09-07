import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// defineConfig from 'vitest/config' re-exports Vite's own defineConfig, just
// with its type extended to also recognize the `test` block below — single
// config file for both Vite and Vitest, the standard setup for this combo.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  optimizeDeps: {
    // PowerSync's WASM SQLite engine doesn't survive esbuild's dependency pre-bundling
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
  },
  worker: {
    // PowerSync runs its SQLite engine inside a worker; ESM workers support
    // the dynamic import()/top-level await that engine's WASM loading needs.
    // vite-plugin-wasm / vite-plugin-top-level-await are NOT used here —
    // Vite 8 (Rolldown) has native WASM + top-level-await support built in,
    // and those two packages are incompatible with Vite 8 anyway (they
    // depend directly on the classic `rollup` package, which Vite 8 no
    // longer bundles).
    format: 'es',
  },
  test: {
    // 'node', not 'jsdom' — no DOM-touching tests yet.
    environment: 'node',
  },
})
