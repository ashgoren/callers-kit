import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// Skipped: title editing moved out of the table/card view (now read-only,
// see DancesPage.tsx) into the not-yet-built detail view, so there's
// currently no UI path to trigger the edit this test drives through.
// Re-enable once that view has a real editable field.
test.skip('editing a dance offline syncs to Supabase once back online', async ({
  page,
  context,
}) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const startingTitle = process.env.E2E_TEST_DANCE_TITLE!
  const newTitle = `E2E Test Dance ${Date.now()}`

  // A separate client, signed in independently of the browser under test —
  // used only to verify the row on the server directly, so this test can't
  // be fooled by the app just reading back its own local SQLite cache.
  const verificationClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  )
  const { error: signInError } = await verificationClient.auth.signInWithPassword({
    email,
    password,
  })
  expect(signInError).toBeNull()

  try {
    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(email)).toBeVisible()

    const titleButton = page.getByRole('button', { name: startingTitle })
    await expect(titleButton).toBeVisible()

    await context.setOffline(true)

    await titleButton.click()
    const input = page.getByRole('textbox')
    await input.fill(newTitle)
    await input.blur()

    // Still offline: the new value must already be reflected locally —
    // this is the actual point of local-first writes.
    await expect(page.getByRole('button', { name: newTitle })).toBeVisible()

    await context.setOffline(false)

    // Poll the real database directly (not the app's UI) until the write
    // actually lands, proving the change reached Supabase rather than just
    // sitting in the local cache.
    await expect
      .poll(
        async () => {
          const { data } = await verificationClient
            .from('dances')
            .select('title')
            .eq('id', danceId)
            .single()
          return data?.title as string | undefined
        },
        { timeout: 20_000, message: 'waiting for the offline edit to sync to Supabase' },
      )
      .toBe(newTitle)
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed.
    await verificationClient.from('dances').update({ title: startingTitle }).eq('id', danceId)
  }
})
