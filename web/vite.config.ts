import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
})
