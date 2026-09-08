import { expect, test } from '@playwright/test'

test('the dances table shows a card list on phone width and the real table from tablet width up', async ({
  page,
}) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

  // Phone width (well under the sm: 640px breakpoint) - card list, no table.
  await page.setViewportSize({ width: 500, height: 800 })
  await expect(page.getByRole('list')).toBeVisible()
  await expect(page.getByRole('table')).not.toBeVisible()

  // Tablet-and-up width (comfortably over 640px, e.g. iPad portrait) - the
  // real table, not the card fallback. This breakpoint was deliberately
  // widened from an original 1024px cutoff after a real-device check
  // confirmed the table itself is usefully navigable on iPad in portrait,
  // not just landscape - see web/README.md's Dances section. Both elements
  // are always in the DOM regardless of viewport (CSS `hidden`/`block`
  // toggling, not conditional rendering), so this only proves anything
  // because toBeVisible()/not.toBeVisible() check real computed visibility.
  await page.setViewportSize({ width: 700, height: 900 })
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('list')).not.toBeVisible()
})
