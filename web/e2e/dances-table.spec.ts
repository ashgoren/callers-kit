import { expect, test } from '@playwright/test'

test('the dances table renders real data, including the choreographers, key_moves, and vibes columns', async ({
  page,
}) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!
  const choreographer1 = process.env.E2E_TEST_CHOREOGRAPHER_1!
  const choreographer2 = process.env.E2E_TEST_CHOREOGRAPHER_2!
  const keyMove1 = process.env.E2E_TEST_KEY_MOVE_1!
  const vibe1 = process.env.E2E_TEST_VIBE_1!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/dances')
  const table = page.getByRole('table')
  await expect(table).toBeVisible()

  // Both choreographers are durable seed data on this dance (not created and
  // cleaned up per run, unlike offline-sync.spec.ts's title mutation) - this
  // test only reads, so there's nothing to revert. Asserting on two, not
  // one, also confirms the query's json_group_array/join-with-", "
  // behavior across multiple names, not just that a single join works.
  const row = table.getByRole('row', { name: new RegExp(danceTitle) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(danceTitle)
  await expect(row).toContainText(choreographer1)
  await expect(row).toContainText(choreographer2)

  // key_moves/vibes each only need one fixture name here - the multi-name
  // join behavior is already proven above by the two choreographers; this
  // just confirms the query correctly picks up a different junction
  // table/column pair.
  await expect(row).toContainText(keyMove1)
  await expect(row).toContainText(vibe1)
})
