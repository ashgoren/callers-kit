import { expect, test } from '@playwright/test'

test('the programs table renders real data, including its ordered dance lineup', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programLocation = process.env.E2E_TEST_PROGRAM_LOCATION!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/dances')
  await page.getByRole('link', { name: 'Programs' }).click()
  await expect(page).toHaveURL('/programs')

  const table = page.getByRole('table')
  await expect(table).toBeVisible()

  // Durable seed data (see e2e/.env's E2E_TEST_PROGRAM_ID) - this test only
  // reads, so there's nothing to revert.
  const row = table.getByRole('row', { name: new RegExp(programLocation) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(programLocation)
  // Confirms the programs_dances join/order and the "N. Title" chip format,
  // not just that the location column works.
  await expect(row).toContainText(`1. ${danceTitle}`)
})

test('hovering a truncated Notes cell reveals its full text via a real tooltip, not the browser\'s native title attribute', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programNotes = process.env.E2E_TEST_PROGRAM_NOTES!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('link', { name: 'Programs' }).click()
  await expect(page).toHaveURL('/programs')

  const notesTrigger = page.getByRole('button', { name: programNotes })
  // A real tooltip, not the native title attribute - jsdom can't mount/open
  // it (Tooltip.Portal only mounts its content once actually opened), so
  // this is the one place that behavior is verified at all.
  await expect(notesTrigger).not.toHaveAttribute('title')
  await notesTrigger.hover()
  // Scoped to the tooltip's own data-slot (see components/ui/tooltip.tsx),
  // not just any matching text - the trigger itself already contains this
  // same text, so an unscoped getByText would match both.
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(programNotes)
})

test('clicking a program row opens its detail page, showing the same real data', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programLocation = process.env.E2E_TEST_PROGRAM_LOCATION!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('link', { name: 'Programs' }).click()
  await expect(page).toHaveURL('/programs')

  await page.getByRole('row', { name: new RegExp(programLocation) }).click()

  await expect(page).toHaveURL(/\/programs\/.+/)
  // The URL updates before React Router actually swaps the rendered page -
  // asserting on it alone isn't enough, since the programs list (including
  // its off-screen sm:hidden mobile-card markup, which repeats the
  // location text in "date @ location" form) can still be mounted for a
  // moment afterward, making an unscoped getByText ambiguous. Waiting for
  // the list's own table to actually disappear avoids that race.
  await expect(page.getByRole('table')).not.toBeVisible()
  // Location is its own line below the date heading now, not combined into
  // the heading text itself.
  await expect(page.getByText(programLocation)).toBeVisible()
  await expect(page.getByText(`1. ${danceTitle}`)).toBeVisible()
})
