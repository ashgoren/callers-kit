import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

test('the dance detail page renders real figures data', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const phrase = process.env.E2E_TEST_DANCE_FIGURE_PHRASE!
  const beats = process.env.E2E_TEST_DANCE_FIGURE_BEATS!
  const description = process.env.E2E_TEST_DANCE_FIGURE_DESCRIPTION!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

  await page.goto(`/dances/${danceId}`)

  await expect(page.getByText(phrase)).toBeVisible()
  await expect(page.getByText(beats)).toBeVisible()
  await expect(page.getByText(description)).toBeVisible()
})

test('the figure formatting toolbar appears while editing, and Bold actually formats the text', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const phrase = process.env.E2E_TEST_DANCE_FIGURE_PHRASE!
  const beats = Number(process.env.E2E_TEST_DANCE_FIGURE_BEATS!)
  const description = process.env.E2E_TEST_DANCE_FIGURE_DESCRIPTION!

  // A separate client, signed in independently of the browser under test -
  // used to both verify the edit actually reached the server (not just the
  // app's own local SQLite cache) and to revert it afterward, the same
  // pattern offline-sync.spec.ts uses for its own title mutation.
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

    await page.getByText(description).click()

    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' })
    await expect(toolbar).toBeVisible()

    await toolbar.getByRole('button', { name: 'Bold' }).click()

    const editor = page.locator('[contenteditable="true"]')
    // A real click here, not just relying on the field's own focus('end') -
    // this is exactly the kind of real-browser focus/selection behavior a
    // jsdom-based test can't fully verify, which is the whole point of
    // covering this in e2e rather than only in Vitest.
    await editor.click()
    await editor.press('End')
    await editor.type('!')

    await expect(editor.locator('strong')).toHaveText('!')

    // Tab both blurs and commits (matching every other short field in the
    // app) - the toolbar disappearing again is what proves it's actually
    // tracking "is a figure currently being edited," not just showing once
    // and staying stuck.
    await editor.press('Tab')
    await expect(toolbar).not.toBeVisible()

    await expect
      .poll(
        async () => {
          const { data } = await verificationClient
            .from('dance_versions')
            .select('figures')
            .eq('dance_id', danceId)
            .order('order', { ascending: true })
            .limit(1)
            .single()
          const figures = data?.figures as { id: string; description: string }[] | undefined
          return figures?.find((figure) => figure.id === 'e2e-figure-1')?.description
        },
        { timeout: 10_000, message: 'waiting for the bolded edit to sync to Supabase' },
      )
      .toContain('<strong>!</strong>')
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed - matches the fixture the
    // e2e_test_dance_figures seed migration set up.
    const { data } = await verificationClient
      .from('dance_versions')
      .select('id')
      .eq('dance_id', danceId)
      .order('order', { ascending: true })
      .limit(1)
      .single()
    if (data) {
      await verificationClient
        .from('dance_versions')
        .update({ figures: [{ id: 'e2e-figure-1', kind: 'figure', phrase, beats, description }] })
        .eq('id', data.id)
    }
  }
})
