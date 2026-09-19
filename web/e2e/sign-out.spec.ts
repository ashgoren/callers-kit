import { expect, test } from '@playwright/test'

test('sign out clears the session and redirects to /signin', async ({ page }) => {
  // Already signed in via the shared storageState (see playwright.config.ts) -
  // no need to drive the sign-in form itself just to reach a signed-in state.
  await page.goto('/dances')

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/signin')

  // Confirm the session is actually gone server/client-state-wise, not just
  // a one-off route change - revisiting a protected route while genuinely
  // signed out should redirect right back, not render stale content.
  await page.goto('/dances')
  await expect(page).toHaveURL('/signin')
})
