import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

test('editing and saving a dance version\'s notes persists to Supabase', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const startingNotes = process.env.E2E_TEST_DANCE_NOTES!
  const addedText = ' Added by e2e.'

  // A separate client, signed in independently of the browser under test -
  // used to both verify the save actually reached the server (not just the
  // app's own local SQLite cache) and to revert it afterward, the same
  // pattern offline-sync.spec.ts and dance-detail-figures.spec.ts use for
  // their own mutations.
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

    await page.getByText(startingNotes).click()

    const editor = page.locator('[contenteditable="true"]')
    await editor.click()
    await editor.press('End')
    await editor.type(addedText)

    const saveButton = page.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect(page.getByText(startingNotes + addedText)).toBeVisible()

    await expect
      .poll(
        async () => {
          const { data } = await verificationClient
            .from('dance_versions')
            .select('notes')
            .eq('dance_id', danceId)
            .order('order', { ascending: true })
            .limit(1)
            .single()
          return data?.notes as string | undefined
        },
        { timeout: 10_000, message: 'waiting for the saved note to sync to Supabase' },
      )
      .toContain(addedText.trim())
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed.
    const { data } = await verificationClient
      .from('dance_versions')
      .select('id')
      .eq('dance_id', danceId)
      .order('order', { ascending: true })
      .limit(1)
      .single()
    if (data) {
      await verificationClient.from('dance_versions').update({ notes: `<p>${startingNotes}</p>` }).eq('id', data.id)
    }
  }
})
