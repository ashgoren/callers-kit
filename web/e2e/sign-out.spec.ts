import { expect, test } from '@playwright/test'

test('sign out clears the session and redirects to /signin', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

  await page.getByRole('button', { name: email }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/signin')

  // Confirm the session is actually gone server/client-state-wise, not just
  // a one-off route change - revisiting a protected route while genuinely
  // signed out should redirect right back, not render stale content.
  await page.goto('/dances')
  await expect(page).toHaveURL('/signin')
})
