import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// Covers composed-bouncing-candy Steps 1-2, which only ever got vitest
// coverage: opening a dance detail page from the table (already covered by
// dances-table.spec.ts's own "opens its detail page" test) and editing one
// of its plain blur-save fields. Only the rich-text-specific
// dance-detail-notes.spec.ts/dance-detail-figures.spec.ts existed before
// this - difficulty is a real round-trip through PowerSync + Supabase a
// jsdom test mocking the db can't prove.
test('editing a plain blur-save field (difficulty) on the dance detail page persists across a reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  try {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto(`/dances/${danceId}`)

    // Difficulty starts unset (the "-" placeholder) on the e2e fixture
    // dance - dt/dd are adjacent siblings within FieldList's own markup, so
    // this scopes to the Difficulty field's value specifically rather than
    // any other field that happens to render the same placeholder.
    const difficultyValue = page.locator('dt:text("Difficulty") + dd')
    // Click the actual clickable display element, not just anywhere inside
    // the dd - the dd itself is a block that can be wider than its inline,
    // content-sized child, so a click on the dd's own bounding-box center
    // can miss the child entirely.
    await difficultyValue.getByText('—').click()

    const input = difficultyValue.getByRole('textbox')
    await input.fill('3')
    await input.press('Tab')

    await expect(difficultyValue).toHaveText('3')

    // The display above updates from local optimistic state the instant
    // commit() fires, before commitFieldEdit's own local db write has
    // actually landed - not proof of real persistence yet. Waiting for the
    // edit to reach Supabase (round-tripping through the real local
    // PowerSync db first) confirms the local write landed before the
    // reload below re-reads from that same local db.
    await expect
      .poll(
        async () => {
          const { data } = await verificationClient.from('dances').select('difficulty').eq('id', danceId).single()
          return data?.difficulty as number | null | undefined
        },
        { timeout: 10_000, message: 'waiting for the edited difficulty to sync to Supabase' },
      )
      .toBe(3)

    await page.reload()
    await expect(page.locator('dt:text("Difficulty") + dd')).toHaveText('3')
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed - matches the fixture's original
    // unset difficulty.
    await verificationClient.from('dances').update({ difficulty: null }).eq('id', danceId)
  }
})
