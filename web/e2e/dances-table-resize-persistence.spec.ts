import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// The one thing jsdom can't prove: that a resized column width actually
// survives a real page reload, round-tripping through the real local
// PowerSync db and the real synced user_table_preferences row - not just the
// in-memory table state DancesPage.test.tsx exercises with a mocked db.
test('resizing a column persists across a reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  // A separate client, signed in independently of the browser under test -
  // used to capture and restore this account's real column_state, the same
  // "reset regardless of pass/fail" discipline offline-sync.spec.ts uses for
  // the dance row it mutates.
  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { data: signInData, error: signInError } = await verificationClient.auth.signInWithPassword({
    email,
    password,
  })
  expect(signInError).toBeNull()
  const userId = signInData.user!.id

  const { data: existingRow } = await verificationClient
    .from('user_table_preferences')
    .select('column_state')
    .eq('user_id', userId)
    .eq('table_name', 'dances')
    .single()
  const originalColumnState = existingRow?.column_state as unknown

  try {
    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dances')

    const difficultyHeader = page.getByRole('columnheader', { name: 'Difficulty' })
    const handle = difficultyHeader.locator('.cursor-col-resize')
    const box = await handle.boundingBox()
    if (!box) throw new Error('expected the resize handle to have a bounding box')

    const widthBefore = (await difficultyHeader.boundingBox())?.width
    if (widthBefore === undefined) throw new Error('expected Difficulty header to have a width')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 })
    await page.mouse.up()

    const widthAfterDrag = (await difficultyHeader.boundingBox())?.width
    if (widthAfterDrag === undefined) throw new Error('expected Difficulty header to still have a width after dragging')
    expect(widthAfterDrag).toBeGreaterThan(widthBefore + 50)

    await page.reload()
    await expect(page.getByRole('columnheader', { name: 'Difficulty' })).toBeVisible()

    const widthAfterReload = (await page.getByRole('columnheader', { name: 'Difficulty' }).boundingBox())?.width
    if (widthAfterReload === undefined) throw new Error('expected Difficulty header to have a width after reload')
    // Small tolerance for sub-pixel layout rounding across two separate
    // renders of the same underlying persisted value.
    expect(Math.abs(widthAfterReload - widthAfterDrag)).toBeLessThan(2)
  } finally {
    await verificationClient
      .from('user_table_preferences')
      .update({ column_state: originalColumnState })
      .eq('user_id', userId)
      .eq('table_name', 'dances')
  }
})
