import { expect, test } from '@playwright/test'

test('the programs table renders real data, including its ordered dance lineup', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programLocation = process.env.E2E_TEST_PROGRAM_LOCATION!
  const danceTitle = process.env.E2E_TEST_DANCE_TITLE!

  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/dances')
  await page.getByRole('link', { name: 'Programs' }).click()
  await expect(page).toHaveURL('/programs')

  const table = page.getByRole('table')
  await expect(table).toBeVisible()

  // Durable seed data (see e2e/.env's E2E_TEST_PROGRAM_ID) - this test only
  // reads, so there's nothing to revert.
  const row = table.getByRole('row', { name: new RegExp(programLocation) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(programLocation)
  // Confirms the programs_dances join/order and the "N. Title" chip format,
  // not just that the location column works.
  await expect(row).toContainText(`1. ${danceTitle}`)
})
