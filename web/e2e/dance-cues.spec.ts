import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// No Playwright e2e smoke spec existed for the cues route at all - only
// jsdom coverage of CuesGrid/DanceCuesPage in isolation. Follows
// dance-detail-notes.spec.ts's own pattern: navigate, edit a cell, edit
// notes, reload, confirm persistence - a real round-trip through PowerSync
// + Supabase a mocked-db jsdom test can't prove.
test('editing a cue cell and the cues notes on the cues page persists across a reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const startingCue = 'E2E Test Cue'
  const startingNotes = 'E2E Test Cue Notes'
  const editedCue = 'Edited by e2e'
  const addedNotesText = ' Added by e2e.'

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  try {
    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dances')

    await page.goto(`/dances/${danceId}/cues`)

    // Edit the seeded cell (dance_versions.cues.cells["A1:0:0"] - see
    // 20260919160000_seed_e2e_test_dance_cues.sql) - a compact rich-text
    // field, same blur/Enter-commits behavior as a figure's own text.
    await page.getByText(startingCue, { exact: true }).click()
    const cellEditor = page.locator('[contenteditable="true"]')
    // A cue cell is only ~60px wide (see COL_WIDTH/CELL_CONTENT_WIDTH in
    // lib/cues.ts), so this short text already wraps onto multiple visual
    // lines - unlike the other, much wider rich-text fields this pattern is
    // otherwise shared with, plain End only reaches the end of whichever
    // line was clicked, not the end of the whole field. Replacing the
    // entire selection sidesteps needing a reliable "true end" position at
    // all - this route's own point is proving the real PowerSync/Supabase
    // round-trip, not re-proving cursor placement (already covered by
    // dance-detail-figures.spec.ts's own Bold-formatting test).
    await cellEditor.press('ControlOrMeta+a')
    await cellEditor.type(editedCue)
    await cellEditor.press('Tab')

    await expect(page.getByText(editedCue, { exact: true })).toBeVisible()

    // Edit the cues notes - a full EditableRichText field, Save-button
    // commits like dance-detail-notes.spec.ts's own notes field.
    await page.getByText(startingNotes).click()
    const notesEditor = page.locator('[contenteditable="true"]')
    await notesEditor.click()
    await notesEditor.press('End')
    await notesEditor.type(addedNotesText)

    const saveButton = page.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect(page.getByText(startingNotes + addedNotesText)).toBeVisible()

    await expect
      .poll(
        async () => {
          const { data } = await verificationClient
            .from('dance_versions')
            .select('cues')
            .eq('dance_id', danceId)
            .order('order', { ascending: true })
            .limit(1)
            .single()
          const cues = data?.cues as { cells?: Record<string, string>; notes?: string } | undefined
          return cues?.cells?.['A1:0:0']
        },
        { timeout: 10_000, message: 'waiting for the edited cue cell to sync to Supabase' },
      )
      .toContain(editedCue)

    await expect
      .poll(
        async () => {
          const { data } = await verificationClient
            .from('dance_versions')
            .select('cues')
            .eq('dance_id', danceId)
            .order('order', { ascending: true })
            .limit(1)
            .single()
          const cues = data?.cues as { cells?: Record<string, string>; notes?: string } | undefined
          return cues?.notes
        },
        { timeout: 10_000, message: 'waiting for the edited cues notes to sync to Supabase' },
      )
      .toContain(addedNotesText.trim())

    await page.reload()
    await expect(page.getByText(editedCue, { exact: true })).toBeVisible()
    await expect(page.getByText(startingNotes + addedNotesText)).toBeVisible()
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed - matches the fixture the
    // e2e_test_dance_cues seed migration set up.
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
        .update({ cues: { cells: { 'A1:0:0': startingCue }, notes: startingNotes } })
        .eq('id', data.id)
    }
  }
})
