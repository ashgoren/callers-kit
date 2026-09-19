import { expect, test as setup } from '@playwright/test'
import { STORAGE_STATE_PATH } from './storageState.js'

// Runs once before the real test projects (see playwright.config.ts's
// "setup" project + the chromium project's own dependency on it), signing
// in through the real UI exactly once and saving the resulting session to
// disk. Every other spec that just needs to already be signed in reuses
// that saved storageState instead of repeating this same UI flow itself -
// with ~20 spec files, each redoing a full UI sign-in on every run added up
// to enough concurrent requests to occasionally trip Supabase Auth's own
// rate limiting under a fully parallel run. Specs that specifically test
// the sign-in/sign-out/sign-up/auth-redirect flows still exercise the real
// UI directly (see their own files) - this setup step doesn't replace that
// coverage, it just stops every *other* spec from needlessly repeating it.
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

  await page.context().storageState({ path: STORAGE_STATE_PATH })
})
