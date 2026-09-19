import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// EditableLocationCombobox never had e2e coverage of its own - only vitest,
// which can't confirm a real Base UI popover actually opens/positions/
// closes in a real browser, or that the create-and-select path really
// round-trips two separate writes (creating the location row, then
// updating programs.location_id) through PowerSync + Supabase.
test('creating and selecting a new location on the program detail page persists across a reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programId = process.env.E2E_TEST_PROGRAM_ID!
  const originalLocationName = process.env.E2E_TEST_PROGRAM_LOCATION!
  const newLocationName = 'E2E Test Location To Add'

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  const { data: originalProgram, error: programError } = await verificationClient
    .from('programs')
    .select('location_id')
    .eq('id', programId)
    .single()
  expect(programError).toBeNull()
  const originalLocationId = originalProgram!.location_id as string

  try {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto(`/programs/${programId}`)

    await page.getByText(originalLocationName, { exact: true }).click()
    await page.getByRole('combobox').fill(newLocationName)
    await page.getByRole('option', { name: `Create "${newLocationName}"` }).click()

    await expect(page.getByText(newLocationName, { exact: true })).toBeVisible()

    await expect
      .poll(
        async () => {
          const { data: location } = await verificationClient.from('locations').select('id').eq('name', newLocationName).maybeSingle()
          if (!location) return null
          const { data: program } = await verificationClient.from('programs').select('location_id').eq('id', programId).single()
          return program?.location_id === location.id
        },
        { timeout: 10_000, message: 'waiting for the new location and the program update to sync to Supabase' },
      )
      .toBe(true)

    await page.reload()
    await expect(page.getByText(newLocationName, { exact: true })).toBeVisible()
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed - the location itself is only ever
    // created by this test, so it's safe to delete outright once the
    // program no longer references it.
    await verificationClient.from('programs').update({ location_id: originalLocationId }).eq('id', programId)
    await verificationClient.from('locations').delete().eq('name', newLocationName)
  }
})
