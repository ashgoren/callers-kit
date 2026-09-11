import { expect, test } from '@playwright/test'
import { getTouchClient, quickSwipe } from './touch-helpers.js'

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
test.use({
  viewport: { width: 768, height: 1024 },
  hasTouch: true,
  isMobile: true,
})

async function signIn(page: import('@playwright/test').Page) {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')
}

test('dragging a row in the Columns menu with the mouse reorders both the menu and the table headers', async ({ page }) => {
  await signIn(page)
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
  await signIn(page)
  await page.getByRole('button', { name: 'Columns' }).click()

  // Title is pinned by default and Choreographers is the first unpinned row
  // (same boundary dances-table-reorder.spec.ts's header-row version of this
  // test drags across) - makeSameGroupCollisionDetection should keep Title
  // out of the candidate drop targets the whole way.
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
  await signIn(page)
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
