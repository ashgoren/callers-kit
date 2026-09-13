import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { getTouchClient, longPressDrag, quickSwipe } from './touch-helpers.js'

// All three tests below resize the same `difficulty` column's width, on the
// same shared e2e test account, via the real synced user_table_preferences
// row - writeColumnState reads the row, merges in a patch, and writes the
// whole blob back, so two of these running in different parallel workers at
// once would race (whichever commits last wins, silently dropping the
// other's change - the same "not specially reconciled" tradeoff
// useTableColumnState.ts already accepts for real concurrent devices, just
// triggered far more readily by Playwright's own parallelism than a real
// person ever would). Serial mode keeps all three in one worker, one after
// another, so they can't race each other.
test.describe.configure({ mode: 'serial' })

// Centralized reset, not one test's own try/finally - a long-press-drag
// resize is a real interaction that genuinely persists through the app, the
// same as the reload test's own drag, so every test here needs the same
// "restore what was there before" treatment, not just the one that
// originally had it. Captured once via beforeAll (one sign-in, one read),
// restored after every single test via afterEach regardless of pass/fail,
// so each test always starts from the same baseline no matter what a
// previous test in this file did.
const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
let userId: string
let originalColumnState: unknown

test.beforeAll(async () => {
  const { data, error } = await verificationClient.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL!,
    password: process.env.E2E_TEST_PASSWORD!,
  })
  expect(error).toBeNull()
  userId = data.user!.id

  const { data: existingRow } = await verificationClient
    .from('user_table_preferences')
    .select('column_state')
    .eq('user_id', userId)
    .eq('table_name', 'dances')
    .single()
  originalColumnState = existingRow?.column_state
})

test.afterEach(async () => {
  await verificationClient
    .from('user_table_preferences')
    .update({ column_state: originalColumnState })
    .eq('user_id', userId)
    .eq('table_name', 'dances')
})

// The one thing jsdom can't prove: that a resized column width actually
// survives a real page reload, round-tripping through the real local
// PowerSync db and the real synced user_table_preferences row - not just the
// in-memory table state DancesPage.test.tsx exercises with a mocked db.
test('resizing a column persists across a reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

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
})

// The touch-specific counterpart to column resizing (only unit-tested via
// mouse in DancesPage.test.tsx, since that's pure clientX arithmetic once a
// drag is underway) - a real touch gesture is the only way to prove the
// long-press-first requirement and the manual scroll takeover in
// ColumnResizeHandle.tsx actually behave as designed: a quick swipe should
// scroll the table, and only a genuine hold-then-drag should resize a
// column. Neither can be faked in jsdom (no real touch-action enforcement,
// no real gesture timing).
test.describe('touch gestures', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true,
  })

  test('a quick swipe over a resize divider scrolls the table instead of resizing the column', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!
    const password = process.env.E2E_TEST_PASSWORD!

    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dances')

    const scrollContainer = page.locator('[data-slot="table-container"]')
    await expect(scrollContainer).toHaveJSProperty('scrollLeft', 0)

    const difficultyHeader = page.getByRole('columnheader', { name: 'Difficulty' })
    const handle = difficultyHeader.locator('.cursor-col-resize')
    const box = await handle.boundingBox()
    if (!box) throw new Error('expected the resize handle to have a bounding box')

    const widthBefore = (await difficultyHeader.boundingBox())?.width

    const client = await getTouchClient(page)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    // Total column width comfortably exceeds this viewport's 768px, so the
    // table is real horizontally scrollable - swiping left reveals columns
    // further right, the same direction dragging the divider itself would
    // reveal them if this were misread as a resize instead.
    await quickSwipe(client, x, y, x - 150, y)

    await expect(scrollContainer).not.toHaveJSProperty('scrollLeft', 0)
    expect((await difficultyHeader.boundingBox())?.width).toBe(widthBefore)
  })

  test('a long-press then drag on a resize divider resizes the column instead of scrolling', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!
    const password = process.env.E2E_TEST_PASSWORD!

    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dances')

    const scrollContainer = page.locator('[data-slot="table-container"]')

    const difficultyHeader = page.getByRole('columnheader', { name: 'Difficulty' })
    const handle = difficultyHeader.locator('.cursor-col-resize')
    const box = await handle.boundingBox()
    if (!box) throw new Error('expected the resize handle to have a bounding box')

    const widthBefore = (await difficultyHeader.boundingBox())?.width
    if (widthBefore === undefined) throw new Error('expected Difficulty header to have a width')

    const client = await getTouchClient(page)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await longPressDrag(client, x, y, x + 100, y)

    const widthAfter = (await difficultyHeader.boundingBox())?.width
    expect(widthAfter).toBeGreaterThan(widthBefore + 50)
    await expect(scrollContainer).toHaveJSProperty('scrollLeft', 0)
  })
})
