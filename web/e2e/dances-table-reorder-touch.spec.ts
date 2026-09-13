import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { getTouchClient, longPressDrag, quickTap } from './touch-helpers.js'

// The touch-specific counterpart to dances-table-reorder.spec.ts's mouse
// drag: a real touch gesture is the only way to prove the long-press-first
// requirement (useLongPressTouch/TouchSensor's delay+tolerance) actually
// disambiguates a tap-to-sort from a hold-then-drag-to-reorder on real
// touch input - jsdom can fake neither the gesture timing nor the real
// getBoundingClientRect values dnd-kit's collision detection depends on.
test.use({
  viewport: { width: 768, height: 1024 },
  hasTouch: true,
  isMobile: true,
})

// Both tests below persist to the same shared e2e test account's real synced
// user_table_preferences row (a sort toggle and a column reorder,
// respectively) - same capture/restore pattern as
// dances-table-reorder.spec.ts and dances-table-resize.spec.ts, for the same
// reason: without it, this file would permanently drift the account's
// column/sort state every time it runs.
test.describe.configure({ mode: 'serial' })

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

test('a quick tap on a header sorts instead of reordering', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

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
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dances')

  // Both columns are unpinned, so this drag stays within a single reorder
  // group - drag Choreographers' header past Key Moves' header to swap them,
  // the same pair dances-table-reorder.spec.ts's mouse version swaps.
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
