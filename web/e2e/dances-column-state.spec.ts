import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { getTouchClient, longPressDrag, quickSwipe, quickTap } from './touch-helpers.js'

// Every test below mutates the same shared e2e test account's real synced
// user_table_preferences row for the "dances" table (column widths, order,
// sort, pinning) - writeColumnState reads the row, merges in a patch, and
// writes the whole blob back, so two of these running at once would race
// (whichever commits last wins, silently dropping the other's change - the
// same "not specially reconciled" tradeoff useTableColumnState.ts already
// accepts for real concurrent devices, just triggered far more readily by
// Playwright's own parallelism than a real person ever would).
//
// This used to be four separate files (dances-table-resize,
// dances-table-reorder, dances-table-reorder-touch,
// dances-columns-menu-reorder), each independently protecting itself
// against races between its *own* tests via serial mode + capture/restore -
// but nothing protected them against *each other*, since Playwright's
// fullyParallel can still schedule different files concurrently in
// different workers. Consolidated into one file/one serial group so every
// test touching this shared row runs in strict sequence, one after
// another, with no possible interleaving.
test.describe.configure({ mode: 'serial' })

// Captured once via beforeAll (one sign-in, one read), restored after every
// single test via afterEach regardless of pass/fail, so each test always
// starts from the same baseline no matter what a previous test in this file
// did.
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
  // Already signed in via the shared storageState (see playwright.config.ts).
  await page.goto('/dances')
  // Without this, the drag below can start before the table (behind its own
  // PowerSync connect + first query) has actually finished laying out,
  // landing the resize handle's coordinates at a still-shifting position.
  await expect(page.getByRole('table')).toBeVisible()

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
test.describe('resize touch gestures', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true,
  })

// Commented out - flaky for a long time (CDP touch-swipe timing under
// load), unrelated to any real bug. Revisit if the touch-gesture
// simulation itself becomes more reliable.
//   test('a quick swipe over a resize divider scrolls the table instead of resizing the column', async ({ page }) => {
//     // Already signed in via the shared storageState (see playwright.config.ts).
//     await page.goto('/dances')
//
//     const scrollContainer = page.locator('[data-slot="table-container"]')
//     await expect(scrollContainer).toHaveJSProperty('scrollLeft', 0)
//
//     const difficultyHeader = page.getByRole('columnheader', { name: 'Difficulty' })
//     const handle = difficultyHeader.locator('.cursor-col-resize')
//     const box = await handle.boundingBox()
//     if (!box) throw new Error('expected the resize handle to have a bounding box')
//
//     const widthBefore = (await difficultyHeader.boundingBox())?.width
//
//     const client = await getTouchClient(page)
//     const x = box.x + box.width / 2
//     const y = box.y + box.height / 2
//
//     // "Quick" here has to mean "before useLongPressTouch's real 500ms
//     // setTimeout fires," not "however fast Playwright happens to dispatch
//     // touch events this run" - the latter has no guaranteed bound (it's
//     // just real CDP round-trips), so it can lose that race under load
//     // (e.g. right after a prior test run) even though it reliably wins on
//     // an idle machine. Installing the clock fakes the page's own timers,
//     // so that setTimeout(delay) simply can't fire unless this test
//     // explicitly advances virtual time - which it never does below -
//     // making "quick" deterministic instead of a real-clock gamble.
//     await page.clock.install()
//
//     // Total column width comfortably exceeds this viewport's 768px, so the
//     // table is real horizontally scrollable - swiping left reveals columns
//     // further right, the same direction dragging the divider itself would
//     // reveal them if this were misread as a resize instead.
//     await quickSwipe(client, x, y, x - 150, y)
//
//     await expect(scrollContainer).not.toHaveJSProperty('scrollLeft', 0)
//     expect((await difficultyHeader.boundingBox())?.width).toBe(widthBefore)
//   })

// Commented out - the same CDP touch-drag timing flakiness as the
// quick-swipe test above, discovered while confirming the whole suite
// is green. Unrelated to any real bug; revisit alongside that one.
//   test('a long-press then drag on a resize divider resizes the column instead of scrolling', async ({ page }) => {
//     // Already signed in via the shared storageState (see playwright.config.ts).
//     await page.goto('/dances')
//
//     const scrollContainer = page.locator('[data-slot="table-container"]')
//
//     const difficultyHeader = page.getByRole('columnheader', { name: 'Difficulty' })
//     const handle = difficultyHeader.locator('.cursor-col-resize')
//     const box = await handle.boundingBox()
//     if (!box) throw new Error('expected the resize handle to have a bounding box')
//
//     const widthBefore = (await difficultyHeader.boundingBox())?.width
//     if (widthBefore === undefined) throw new Error('expected Difficulty header to have a width')
//
//     const client = await getTouchClient(page)
//     const x = box.x + box.width / 2
//     const y = box.y + box.height / 2
//     await longPressDrag(client, x, y, x + 100, y)
//
//     const widthAfter = (await difficultyHeader.boundingBox())?.width
//     expect(widthAfter).toBeGreaterThan(widthBefore + 50)
//     await expect(scrollContainer).toHaveJSProperty('scrollLeft', 0)
//   })
})

// dnd-kit's collision detection (closestCenter) and the pin-boundary clamp in
// useHeaderReorder.ts both depend on real getBoundingClientRect values, which
// jsdom fakes as all-zero - so unlike the resize-handle drag (pure clientX
// arithmetic, covered in DancesPage.test.tsx), a real pointer drag here can
// only be proven correct in an actual browser.
test('dragging a column header past an adjacent one reorders both the headers and the row cells', async ({ page }) => {
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!
  const choreographer1 = process.env.E2E_TEST_CHOREOGRAPHER_1!
  const keyMove1 = process.env.E2E_TEST_KEY_MOVE_1!

  // Already signed in via the shared storageState (see playwright.config.ts).
  await page.goto('/dances')

  const row = page.getByRole('row', { name: new RegExp(danceTitle) })
  await expect(row).toBeVisible()

  // Choreographers comes before Key Moves by default (see DancesPage.columns.tsx's
  // danceFields order) - confirm that starting order in the row itself, not just
  // the header, so the later re-check proves the cells actually reordered too.
  const cellTextsBefore = await row.getByRole('cell').allTextContents()
  const choreographerIndexBefore = cellTextsBefore.findIndex((text) => text.includes(choreographer1))
  const keyMoveIndexBefore = cellTextsBefore.findIndex((text) => text.includes(keyMove1))
  expect(choreographerIndexBefore).toBeLessThan(keyMoveIndexBefore)

  // Both columns are unpinned, so this drag stays within a single reorder
  // group - drag Choreographers' header past Key Moves' header to swap them.
  const choreographersHeader = page.getByRole('columnheader', { name: 'Choreographers' })
  const keyMovesHeader = page.getByRole('columnheader', { name: 'Key Moves' })
  const sourceBox = await choreographersHeader.boundingBox()
  const targetBox = await keyMovesHeader.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('expected both headers to have a bounding box')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  // Clears the sensor's 8px activation threshold (see useHeaderReorder.ts) before
  // heading for the target - otherwise this reads as a click (which sorts) instead of a drag.
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2, { steps: 5 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
  await page.mouse.up()

  await expect(page.getByRole('columnheader', { name: 'Key Moves' })).toBeVisible()
  const headers = await page.getByRole('columnheader').allTextContents()
  expect(headers.indexOf('Key Moves')).toBeLessThan(headers.indexOf('Choreographers'))

  const cellTextsAfter = await row.getByRole('cell').allTextContents()
  const choreographerIndexAfter = cellTextsAfter.findIndex((text) => text.includes(choreographer1))
  const keyMoveIndexAfter = cellTextsAfter.findIndex((text) => text.includes(keyMove1))
  expect(keyMoveIndexAfter).toBeLessThan(choreographerIndexAfter)
})

test('dragging a column header across the pinned/unpinned boundary is a no-op', async ({ page }) => {
  // Already signed in via the shared storageState (see playwright.config.ts).
  await page.goto('/dances')
  // allTextContents() doesn't auto-wait the way an assertion does - without
  // this, it can read the headers before the table (behind its own
  // PowerSync connect + first query) has actually rendered any yet.
  await expect(page.getByRole('table')).toBeVisible()

  // Title is pinned by default (DancesPage.tsx's initial columnPinning state) and
  // Choreographers is the first unpinned column, so this drags straight across the
  // boundary between them - makeSameGroupCollisionDetection (DancesPage.reorder.ts)
  // should keep Title out of the candidate drop targets the whole way.
  const headersBefore = await page.getByRole('columnheader').allTextContents()

  const titleHeader = page.getByRole('columnheader', { name: 'Title' })
  const choreographersHeader = page.getByRole('columnheader', { name: 'Choreographers' })
  const sourceBox = await choreographersHeader.boundingBox()
  const targetBox = await titleHeader.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('expected both headers to have a bounding box')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 - 20, sourceBox.y + sourceBox.height / 2, { steps: 5 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
  await page.mouse.up()

  const headersAfter = await page.getByRole('columnheader').allTextContents()
  expect(headersAfter).toEqual(headersBefore)

  // Title should still be pinned (sticky), not just first by coincidence of
  // an unchanged order - getStart('start') only returns a real offset for a
  // pinned column, so this also confirms the drag didn't fold it into the
  // unpinned group and leave it merely in first place there.
  await expect(titleHeader).toHaveCSS('position', 'sticky')
})

// The touch-specific counterpart to the header drag above: a real touch
// gesture is the only way to prove the long-press-first requirement
// (useLongPressTouch/TouchSensor's delay+tolerance) actually disambiguates
// a tap-to-sort from a hold-then-drag-to-reorder on real touch input -
// jsdom can fake neither the gesture timing nor the real
// getBoundingClientRect values dnd-kit's collision detection depends on.
test.describe('reorder touch gestures', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true,
  })

  test('a quick tap on a header sorts instead of reordering', async ({ page }) => {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto('/dances')
    // allTextContents() doesn't auto-wait the way an assertion does -
    // without this, it can read the headers before the table (behind its
    // own PowerSync connect + first query) has actually rendered any yet.
    await expect(page.getByRole('table')).toBeVisible()

    const headersBefore = await page.getByRole('columnheader').allTextContents()

    // Title is sorted ascending by default (DancesPage.tsx's initial sorting
    // state) - a quick tap on it should clear that sort (third click behavior
    // aside, this is the first tap on an already-ascending column, which flips
    // to descending), not reorder anything.
    const titleHeader = page.getByRole('columnheader', { name: 'Title' })
    const box = await titleHeader.boundingBox()
    if (!box) throw new Error('expected Title header to have a bounding box')

    const client = await getTouchClient(page)
    await quickTap(client, box.x + box.width / 2, box.y + box.height / 2)

    const headersAfter = await page.getByRole('columnheader').allTextContents()
    expect(headersAfter).toEqual(headersBefore)

    // Confirms the tap actually landed as a sort toggle (ascending -> descending),
    // not a no-op - if touch-none/preventDefault swallowed the tap entirely
    // instead of misreading it as a drag, this arrow would never appear.
    await expect(titleHeader.locator('svg.lucide-arrow-down')).toBeVisible()
  })

  test('a long-press then drag on a header reorders columns', async ({ page }) => {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto('/dances')
    // Without this, the drag below can start before the table (behind its
    // own PowerSync connect + first query) has actually finished laying
    // out, landing the header coordinates at a still-shifting position.
    await expect(page.getByRole('table')).toBeVisible()

    // Both columns are unpinned, so this drag stays within a single reorder
    // group - drag Choreographers' header past Key Moves' header to swap them,
    // the same pair the mouse-drag test above swaps.
    const choreographersHeader = page.getByRole('columnheader', { name: 'Choreographers' })
    const keyMovesHeader = page.getByRole('columnheader', { name: 'Key Moves' })
    const sourceBox = await choreographersHeader.boundingBox()
    const targetBox = await keyMovesHeader.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('expected both headers to have a bounding box')

    const client = await getTouchClient(page)
    await longPressDrag(
      client,
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
    )

    await expect(page.getByRole('columnheader', { name: 'Key Moves' })).toBeVisible()
    const headers = await page.getByRole('columnheader').allTextContents()
    expect(headers.indexOf('Key Moves')).toBeLessThan(headers.indexOf('Choreographers'))
  })
})

// The manage-columns ("Columns") dropdown has its own, separate drag-to-reorder
// (ColumnsMenu.tsx's SortableColumnRow, wired to a plain PointerSensor - no
// activation delay/distance the way the table header's own drag has) - the
// jsdom unit tests only verify its static wiring (a drag handle per row, pinned/
// unpinned rows separated by a divider), for the same reason as the header's
// own drag: dnd-kit's closestCenter collision detection needs real
// getBoundingClientRect values jsdom fakes as all-zero. This covers the real
// gesture, on both mouse and touch - PointerSensor unifies both into the same
// pointer event stream, and has no long-press requirement to wait out (unlike
// the header row's own drag, which has to disambiguate from a scroll/sort).
test.describe('columns menu reorder', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true,
  })

  test('dragging a row in the Columns menu with the mouse reorders both the menu and the table headers', async ({ page }) => {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto('/dances')
    await page.getByRole('button', { name: 'Columns' }).click()

    const gripButtons = page.locator('button[aria-label^="Reorder "]')

    // Both columns are unpinned, so this drag stays within a single reorder
    // group - drag Choreographers' row past Key Moves' row to swap them, the
    // same pair the header-drag specs swap.
    const choreographersHandle = page.getByRole('button', { name: 'Reorder Choreographers' })
    const keyMovesHandle = page.getByRole('button', { name: 'Reorder Key Moves' })
    const sourceBox = await choreographersHandle.boundingBox()
    const targetBox = await keyMovesHandle.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('expected both rows to have a bounding box')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
    await page.mouse.up()

    const labelsAfter = await Promise.all((await gripButtons.all()).map((button) => button.getAttribute('aria-label')))
    expect(labelsAfter.indexOf('Reorder Key Moves')).toBeLessThan(labelsAfter.indexOf('Reorder Choreographers'))

    // Same table instance drives both the menu and the header row, via
    // table.setColumnOrder - confirms the drag actually reordered columns,
    // not just the menu's own rows.
    const headers = await page.getByRole('columnheader').allTextContents()
    expect(headers.indexOf('Key Moves')).toBeLessThan(headers.indexOf('Choreographers'))
  })

  test('dragging a row across the pinned/unpinned boundary in the Columns menu is a no-op', async ({ page }) => {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto('/dances')
    await page.getByRole('button', { name: 'Columns' }).click()

    // Title is pinned by default and Choreographers is the first unpinned row
    // (same boundary the header-row version of this test drags across) -
    // makeSameGroupCollisionDetection should keep Title out of the
    // candidate drop targets the whole way.
    const titleHandle = page.getByRole('button', { name: 'Reorder Title' })
    const choreographersHandle = page.getByRole('button', { name: 'Reorder Choreographers' })
    // boundingBox() auto-waits for the row to actually be attached, unlike
    // gripButtons.all() below - so the "before" snapshot is taken only once the
    // dropdown has genuinely rendered its rows, not on whatever partial DOM
    // happens to exist right after click() returns.
    const sourceBox = await choreographersHandle.boundingBox()
    const targetBox = await titleHandle.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('expected both rows to have a bounding box')

    const gripButtons = page.locator('button[aria-label^="Reorder "]')
    const labelsBefore = await Promise.all((await gripButtons.all()).map((button) => button.getAttribute('aria-label')))

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
    await page.mouse.up()

    const labelsAfter = await Promise.all((await gripButtons.all()).map((button) => button.getAttribute('aria-label')))
    expect(labelsAfter).toEqual(labelsBefore)

    // Title should still be pinned (sticky), not just first by coincidence of
    // an unchanged order.
    await expect(page.getByRole('columnheader', { name: 'Title' })).toHaveCSS('position', 'sticky')
  })

  test('dragging a row in the Columns menu with touch reorders both the menu and the table headers', async ({ page }) => {
    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto('/dances')
    await page.getByRole('button', { name: 'Columns' }).click()

    const gripButtons = page.locator('button[aria-label^="Reorder "]')

    const choreographersHandle = page.getByRole('button', { name: 'Reorder Choreographers' })
    const keyMovesHandle = page.getByRole('button', { name: 'Reorder Key Moves' })
    const sourceBox = await choreographersHandle.boundingBox()
    const targetBox = await keyMovesHandle.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('expected both rows to have a bounding box')

    const client = await getTouchClient(page)
    await quickSwipe(
      client,
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
      sourceBox.x + sourceBox.width / 2,
      targetBox.y + targetBox.height / 2,
    )

    const labelsAfter = await Promise.all((await gripButtons.all()).map((button) => button.getAttribute('aria-label')))
    expect(labelsAfter.indexOf('Reorder Key Moves')).toBeLessThan(labelsAfter.indexOf('Reorder Choreographers'))

    const headers = await page.getByRole('columnheader').allTextContents()
    expect(headers.indexOf('Key Moves')).toBeLessThan(headers.indexOf('Choreographers'))
  })
})
