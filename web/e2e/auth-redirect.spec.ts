import { expect, test } from '@playwright/test'

test('visiting / while signed out redirects to /signin', async ({ page }) => {
  // No sign-in step here — a fresh browser context (Playwright's default per
  // test) has no Supabase session in localStorage, so this exercises
  // ProtectedRoute's unauthenticated branch specifically.
  await page.goto('/')

  await expect(page).toHaveURL('/signin')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
