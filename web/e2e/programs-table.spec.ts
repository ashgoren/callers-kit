import { expect, test } from '@playwright/test'

test('the programs table renders real data, including its ordered dance lineup', async ({ page }) => {
  const programLocation = process.env.E2E_TEST_PROGRAM_LOCATION!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!

  // Already signed in via the shared storageState (see playwright.config.ts).
  await page.goto('/programs')

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
  const programNotes = process.env.E2E_TEST_PROGRAM_NOTES!

  // Already signed in via the shared storageState (see playwright.config.ts).
  await page.goto('/programs')

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
  const programLocation = process.env.E2E_TEST_PROGRAM_LOCATION!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!

  // Already signed in via the shared storageState (see playwright.config.ts).
  await page.goto('/programs')

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
  // The order number is its own span, not combined into the link's own text
  // (see cardRenderDanceList in ProgramsPage.columns.tsx) - scoping to the
  // dance's own list item and checking both pieces separately, rather than
  // a single "N. Title" string that was never actually one text node.
  const lineupItem = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: danceTitle }) })
  await expect(lineupItem).toBeVisible()
  await expect(lineupItem).toContainText('1')
})
