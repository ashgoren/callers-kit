import { expect, test } from '@playwright/test'

// Every other spec's browser context starts already signed in (see
// playwright.config.ts's shared storageState) - this is the one test that
// specifically needs the opposite, so it opts out with a blank one instead.
test.use({ storageState: { cookies: [], origins: [] } })

test('visiting / while signed out redirects to /signin', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL('/signin')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
