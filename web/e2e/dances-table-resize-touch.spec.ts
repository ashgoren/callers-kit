import { expect, test } from '@playwright/test'
import { getTouchClient, longPressDrag, quickSwipe } from './touch-helpers.js'

// The touch-specific counterpart to column resizing (only unit-tested via
// mouse in DancesPage.test.tsx, since that's pure clientX arithmetic once a
// drag is underway) - a real touch gesture is the only way to prove the
// long-press-first requirement and the manual scroll takeover in
// ColumnResizeHandle.tsx actually behave as designed: a quick swipe should
// scroll the table, and only a genuine hold-then-drag should resize a
// column. Neither can be faked in jsdom (no real touch-action enforcement,
// no real gesture timing).
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
