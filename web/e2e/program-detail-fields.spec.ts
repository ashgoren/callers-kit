import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// Covers composed-bouncing-candy Steps 1-2 on the Programs side, which only
// ever got vitest coverage: opening a program detail page from the table
// (already covered by programs-table.spec.ts's own "opens its detail page"
// test) and editing its plain blur-save field - date is the one plain
// field left once location moved to its own combobox (see
// program-detail-location.spec.ts).
test('editing the date field on the program detail page persists across a reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programId = process.env.E2E_TEST_PROGRAM_ID!
  const originalDate = process.env.E2E_TEST_PROGRAM_DATE!
  const newDate = '2026-02-02'

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  try {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto(`/programs/${programId}`)

    const heading = page.getByRole('heading', { level: 1 })
    await heading.click()

    const input = page.locator('input[type="date"]')
    await input.fill(newDate)
    // A native date input has separate day/month/year subfields - Tab
    // moves focus between them rather than always leaving the control the
    // way it does for an ordinary text input, so blurring explicitly is
    // the reliable way to trigger this field's blur-commits behavior.
    await input.blur()

    await expect(heading).toHaveText('2/2/26')

    // The heading above updates from local optimistic state the instant
    // commit() fires, before the actual local PowerSync db write has
    // landed - waiting for the edit to reach Supabase confirms the local
    // write is really in place before the reload below re-reads it.
    await expect
      .poll(
        async () => {
          const { data } = await verificationClient.from('programs').select('date').eq('id', programId).single()
          return data?.date as string | null | undefined
        },
        { timeout: 10_000, message: 'waiting for the edited date to sync to Supabase' },
      )
      .toBe(newDate)

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('2/2/26')
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed.
    await verificationClient.from('programs').update({ date: originalDate }).eq('id', programId)
  }
})
