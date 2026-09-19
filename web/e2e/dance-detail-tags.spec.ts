import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// EditableTagCombobox (choreographers/key moves/vibes) never had e2e
// coverage of its own - only vitest, which can't confirm a real Base UI
// popover actually opens/positions/closes in a real browser, or that the
// create-and-attach path really round-trips two separate writes
// (creating the key_move row, then the junction row) through PowerSync +
// Supabase.
test('creating and attaching, then removing, a key move tag on the dance detail page persists to Supabase', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const newTagName = 'E2E Test Key Move To Add'

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  try {
    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dances')

    await page.goto(`/dances/${danceId}`)

    // Key Moves starts with one existing tag (see e2e/.env's
    // E2E_TEST_KEY_MOVE_1) - dt/dd are adjacent siblings within FieldList's
    // own markup, so this scopes to the Key Moves field specifically. The
    // actual clickable display element is the pill/placeholder text itself,
    // not the dd's own (wider) bounding box.
    const keyMovesField = page.locator('dt:text("Key Moves") + dd')
    const keyMoveTag = process.env.E2E_TEST_KEY_MOVE_1!
    await keyMovesField.getByText(keyMoveTag, { exact: true }).click()

    const input = page.getByRole('combobox')
    await input.fill(newTagName)
    await page.getByRole('option', { name: `Create "${newTagName}"` }).click()

    // Creating closes edit mode again (see EditableTagCombobox's own
    // applyChange), returning to the plain read-mode pill display.
    await expect(page.getByText(newTagName, { exact: true })).toBeVisible()

    await expect
      .poll(
        async () => {
          const { data: keyMove } = await verificationClient.from('key_moves').select('id').eq('name', newTagName).maybeSingle()
          if (!keyMove) return false
          const { data: junction } = await verificationClient
            .from('dances_key_moves')
            .select('id')
            .eq('dance_id', danceId)
            .eq('key_move_id', keyMove.id)
          return (junction?.length ?? 0) > 0
        },
        { timeout: 10_000, message: 'waiting for the new tag and its attachment to sync to Supabase' },
      )
      .toBe(true)

    // Remove it again via its own chip's remove button.
    await keyMovesField.getByText(newTagName, { exact: true }).click()
    await page
      .locator('[data-slot="combobox-chip"]', { hasText: newTagName })
      .locator('[data-slot="combobox-chip-remove"]')
      .click()

    await expect(page.getByText(newTagName, { exact: true })).not.toBeVisible()

    await expect
      .poll(
        async () => {
          const { data: keyMove } = await verificationClient.from('key_moves').select('id').eq('name', newTagName).maybeSingle()
          if (!keyMove) return true
          const { data: junction } = await verificationClient
            .from('dances_key_moves')
            .select('id')
            .eq('dance_id', danceId)
            .eq('key_move_id', keyMove.id)
          return (junction?.length ?? 0) === 0
        },
        { timeout: 10_000, message: 'waiting for the tag detachment to sync to Supabase' },
      )
      .toBe(true)
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed - the tag itself is only ever
    // created by this test, so it's safe to delete outright rather than
    // just detaching it.
    const { data: keyMove } = await verificationClient.from('key_moves').select('id').eq('name', newTagName).maybeSingle()
    if (keyMove) {
      await verificationClient.from('dances_key_moves').delete().eq('dance_id', danceId).eq('key_move_id', keyMove.id)
      await verificationClient.from('key_moves').delete().eq('id', keyMove.id)
    }
  }
})
