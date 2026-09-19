import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// The two mutating tests below (Bold formatting, and the interactive-editing
// test at the bottom) both read-modify-write the same dance_versions.figures
// jsonb blob for the shared e2e test account - running them in different
// parallel workers at once would race, the same "not specially reconciled"
// tradeoff dances-table-resize.spec.ts's own comment explains for its own
// shared-row writes. Serial mode keeps every test in this file in one
// worker, one after another, so they can't race each other.
test.describe.configure({ mode: 'serial' })

test('the dance detail page renders real figures data', async ({ page }) => {
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const phrase = process.env.E2E_TEST_DANCE_FIGURE_PHRASE!
  const beats = process.env.E2E_TEST_DANCE_FIGURE_BEATS!
  const description = process.env.E2E_TEST_DANCE_FIGURE_DESCRIPTION!

  // Already signed in via the shared storageState (see playwright.config.ts).
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
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto(`/dances/${danceId}`)

    // Figures are read-only until edit mode is explicitly toggled on.
    await page.getByRole('button', { name: 'Edit figures' }).click()

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

// The figures list's interactive editing (add/reorder/remove a line, edit
// beats) only ever had vitest coverage exercising array-splice logic
// directly - dnd-kit's real drag-and-drop (closestCenter collision
// detection against real getBoundingClientRect values) can only be proven
// correct in an actual browser, the same reasoning dances-table-reorder.spec.ts
// gives for the Dances table's own column-header drag.
test('adding, reordering, editing beats, and removing a figure line persists to Supabase', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!
  const phrase = process.env.E2E_TEST_DANCE_FIGURE_PHRASE!
  const beats = process.env.E2E_TEST_DANCE_FIGURE_BEATS!
  const description = process.env.E2E_TEST_DANCE_FIGURE_DESCRIPTION!

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  try {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto(`/dances/${danceId}`)
    await page.getByRole('button', { name: 'Edit figures' }).click()

    await page.getByRole('button', { name: 'Add figure' }).click()

    // The newly appended row is the only one with an empty beats/description
    // at this point - locating it via its own Remove button (always last,
    // since appendFigure only ever pushes onto the end of the array) rather
    // than a fragile positional/class selector.
    const newRow = page.getByRole('button', { name: 'Remove figure' }).last().locator('xpath=..')
    await newRow.getByText('—').click()
    const beatsInput = newRow.getByRole('textbox')
    await beatsInput.fill('4')
    await beatsInput.press('Tab')
    await expect(newRow.getByText('4', { exact: true })).toBeVisible()

    // Drag the new row's handle up past the original figure's row.
    const originalRow = page.getByRole('button', { name: 'Remove figure' }).first().locator('xpath=..')
    const sourceBox = await newRow.getByRole('button', { name: 'Reorder figure' }).boundingBox()
    const targetBox = await originalRow.getByRole('button', { name: 'Reorder figure' }).boundingBox()
    if (!sourceBox || !targetBox) throw new Error('expected both drag handles to have a bounding box')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    // Clears the sensor's 8px activation threshold (see FiguresList.tsx's
    // MouseSensor) before heading for the target - otherwise this reads as
    // a click instead of a drag.
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 - 20, { steps: 5 })
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
    await page.mouse.up()

    // Every row that shifted position animates into its new slot via
    // useSortable's own CSS transition, not just the dragged one - clicking
    // again before that settles hits a row still mid-transition, landing
    // its "Remove figure" click at coordinates that don't yet match its
    // final position.
    await page.waitForTimeout(300)

    // The rows re-render in the new array order (not just a visual
    // transform), so the edited figure's "4" should now appear before the
    // original figure's beats count in document order.
    const figureRows = page.locator('div.col-span-full.grid-cols-subgrid')
    await expect
      .poll(async () => {
        const text = (await figureRows.allTextContents()).join('\n')
        return text.indexOf('4') - text.indexOf(beats)
      })
      .toBeLessThan(0)

    // Remove the newly added figure again (re-located by its still-unique
    // "4" beats value, since the drag above changed its position), leaving
    // only the original fixture figure.
    await page
      .getByText('4', { exact: true })
      .locator('xpath=ancestor::div[contains(@class, "grid-cols-subgrid")][1]')
      .getByRole('button', { name: 'Remove figure' })
      .click()

    await expect(page.getByRole('button', { name: 'Remove figure' })).toHaveCount(1)
    await expect(page.getByText(description)).toBeVisible()

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
          const figures = data?.figures as unknown[] | undefined
          return figures?.length
        },
        { timeout: 10_000, message: 'waiting for the removed figure to sync to Supabase' },
      )
      .toBe(1)
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
        .update({ figures: [{ id: 'e2e-figure-1', kind: 'figure', phrase, beats: Number(beats), description }] })
        .eq('id', data.id)
    }
  }
})
