import { expect, test } from '@playwright/test'

test('forgot password shows check-your-email for an existing account', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!

  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()

  // This really does call the real resetPasswordForEmail endpoint (no
  // anti-enumeration no-op here, unlike signUp() on an existing confirmed
  // email) - safe to let it actually attempt sending, since the test
  // account's email is on the .test TLD (reserved, non-routable), so there's
  // no real inbox for it to reach. Confirming the actual reset-password page
  // (reached only via a real emailed link) isn't tested here for that reason.
  await expect(page.getByText('Check your email')).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
})
