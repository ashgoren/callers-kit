import { defineConfig, devices } from '@playwright/test'

// Playwright's config/tests run in plain Node, not through Vite — so
// import.meta.env isn't available here. Loading these directly into
// process.env instead: .env.local for the (public, already-safe) Supabase
// URL/publishable key, e2e/.env for the dedicated test account's own
// credentials and seeded test data.
process.loadEnvFile('.env.local')
process.loadEnvFile('e2e/.env')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    // Reuse an already-running `pnpm dev` locally (common — you're usually
    // already running it yourself) instead of failing on a port conflict or
    // spawning a redundant second instance. Only start fresh in CI, where
    // nothing is running yet.
    reuseExistingServer: !process.env.CI,
  },
})
