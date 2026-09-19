import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// ProgramDanceLineup's add/remove/reorder (composed-bouncing-candy Step 3)
// only ever got vitest coverage - dnd-kit's real drag-and-drop (closestCenter
// collision detection against real getBoundingClientRect values) can only be
// proven correct in an actual browser, the same reasoning
// dances-table-reorder.spec.ts gives for the Dances table's own
// column-header drag.
test('adding, reordering, and removing a dance in a program\'s lineup persists to Supabase', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const programId = process.env.E2E_TEST_PROGRAM_ID!
  const originalDanceTitle = process.env.E2E_TEST_DANCE_TITLE!
  const newDanceTitle = 'E2E Test Dance To Add'

  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  // A throwaway second dance, not attached to any program - the e2e test
  // account otherwise only has the one fixture dance already in this
  // program's lineup, so there'd be nothing left to offer in the "Add
  // dance" search otherwise. user_id defaults to auth.uid() on insert, so
  // this lands correctly scoped to the e2e test account under RLS.
  const { data: newDance, error: insertError } = await verificationClient
    .from('dances')
    .insert({ title: newDanceTitle })
    .select('id')
    .single()
  expect(insertError).toBeNull()
  const newDanceId = newDance!.id as string

  try {
    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dances')

    await page.goto(`/programs/${programId}`)
    await page.getByRole('button', { name: 'Edit dances' }).click()

    await page.getByRole('button', { name: 'Add dance' }).click()
    await page.getByPlaceholder('Search dances…').fill(newDanceTitle)
    // The newly-inserted dance still has to sync down from Supabase into
    // this browser's own local PowerSync db before useDances' reactive
    // query can offer it here - findByRole-style auto-waiting (via expect)
    // covers that real propagation delay.
    await expect(page.getByRole('option', { name: newDanceTitle })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('option', { name: newDanceTitle }).click()

    const lineup = page.getByRole('list')
    await expect(lineup.getByText(`2. ${newDanceTitle}`)).toBeVisible()

    await expect
      .poll(
        async () => {
          const { data } = await verificationClient.from('programs_dances').select('id').eq('program_id', programId).eq('dance_id', newDanceId)
          return data?.length
        },
        { timeout: 10_000, message: 'waiting for the added dance to sync to Supabase' },
      )
      .toBe(1)

    // Drag the new dance's row up past the original one.
    const newRow = page.getByText(`2. ${newDanceTitle}`).locator('xpath=..')
    const originalRow = page.getByText(new RegExp(`^1\\. ${originalDanceTitle}$`)).locator('xpath=..')
    const sourceBox = await newRow.getByRole('button', { name: 'Reorder dance' }).boundingBox()
    const targetBox = await originalRow.getByRole('button', { name: 'Reorder dance' }).boundingBox()
    if (!sourceBox || !targetBox) throw new Error('expected both drag handles to have a bounding box')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 - 20, { steps: 5 })
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
    await page.mouse.up()
    // Every row that shifted position animates into its new slot via
    // useSortable's own CSS transition - settling before the next
    // interaction avoids clicking a row still mid-transition.
    await page.waitForTimeout(300)

    await expect(lineup.getByText(`1. ${newDanceTitle}`)).toBeVisible()
    await expect(lineup.getByText(new RegExp(`^2\\. ${originalDanceTitle}$`))).toBeVisible()

    // Remove the newly added dance again, leaving only the original.
    await page.getByText(`1. ${newDanceTitle}`).locator('xpath=..').getByRole('button', { name: 'Remove dance' }).click()

    await expect(lineup.getByText(new RegExp(`^1\\. ${originalDanceTitle}$`))).toBeVisible()
    await expect(page.getByText(newDanceTitle)).not.toBeVisible()

    await expect
      .poll(
        async () => {
          const { data } = await verificationClient.from('programs_dances').select('id').eq('program_id', programId)
          return data?.length
        },
        { timeout: 10_000, message: 'waiting for the removed dance to sync to Supabase' },
      )
      .toBe(1)
  } finally {
    // Reset so the next run starts from the same known state, regardless of
    // whether this run passed or failed.
    await verificationClient.from('programs_dances').delete().eq('program_id', programId).eq('dance_id', newDanceId)
    await verificationClient.from('programs_dances').update({ order: 1 }).eq('program_id', programId)
    await verificationClient.from('dances').delete().eq('id', newDanceId)
  }
})
