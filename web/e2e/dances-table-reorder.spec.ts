import { expect, test } from '@playwright/test'

// dnd-kit's collision detection (closestCenter) and the pin-boundary clamp in
// useHeaderReorder.ts both depend on real getBoundingClientRect values, which
// jsdom fakes as all-zero - so unlike the resize-handle drag (pure clientX
// arithmetic, covered in DancesPage.test.tsx), a real pointer drag here can
// only be proven correct in an actual browser.

test('dragging a column header past an adjacent one reorders both the headers and the row cells', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!
  const choreographer1 = process.env.E2E_TEST_CHOREOGRAPHER_1!
  const keyMove1 = process.env.E2E_TEST_KEY_MOVE_1!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

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
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

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
