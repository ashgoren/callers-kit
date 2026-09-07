import { expect, test } from '@playwright/test'

test('sign up with an existing email shows check-your-email (no new account created)', async ({
  page,
}) => {
  await page.goto('/signup')
  await page.getByLabel('Email').fill(process.env.E2E_TEST_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD!)
  await page.getByLabel('Confirm password').fill(process.env.E2E_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('Check your email')).toBeVisible()
  // Supabase's built-in anti-enumeration protection means signUp() on an
  // already-registered, confirmed email silently no-ops server-side and
  // sends no email — but the client can't distinguish that from a real
  // new signup, so the UI (correctly) shows the same success panel either
  // way. This test only proves the form wires up to the real endpoint and
  // interprets its response correctly, not that a brand-new account can be
  // created and later confirmed (that would need a real inbox to verify).
  //
  // Deliberately reuses the existing E2E_TEST_EMAIL account rather than
  // generating a fresh one each run: a genuinely new signup would leave an
  // orphaned, unconfirmed row in Supabase's auth.users table.
})
