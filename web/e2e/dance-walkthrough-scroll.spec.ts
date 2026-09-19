import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

// This is specifically what jsdom can't verify (no real layout engine) -
// EditableRichText.test.tsx already covers that fillHeight puts the right
// classes on the right elements, but only a real browser can confirm those
// classes actually produce "the page doesn't grow, the editor scrolls
// internally, and the toolbar/Save/Cancel never scroll out of view."
test('a long walkthrough scrolls internally in edit mode, keeping the toolbar and Save/Cancel on screen', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!
  const password = process.env.E2E_TEST_PASSWORD!
  const danceId = process.env.E2E_TEST_DANCE_ID!

  // A separate client, signed in independently of the browser under test -
  // used to seed a long walkthrough directly (much faster and more
  // reliable than typing hundreds of characters through the UI, and this
  // test cares about scroll geometry, not the typing interaction itself)
  // and to revert it afterward, the same pattern the other dance-detail
  // e2e specs use for their own mutations.
  const verificationClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)
  const { error: signInError } = await verificationClient.auth.signInWithPassword({ email, password })
  expect(signInError).toBeNull()

  const { data: versionRow } = await verificationClient
    .from('dance_versions')
    .select('id, walkthrough')
    .eq('dance_id', danceId)
    .order('order', { ascending: true })
    .limit(1)
    .single()
  if (!versionRow) throw new Error('expected the e2e test dance to have a primary version')
  const originalWalkthrough = versionRow.walkthrough as string | null

  // Comfortably taller than the editor's bounded height regardless of
  // viewport size - the point is to force real overflow, not to match any
  // particular pixel count.
  const longWalkthrough = Array.from({ length: 60 }, (_, i) => `<p>Paragraph ${i + 1} of a long e2e test walkthrough.</p>`).join('')

  try {
    await verificationClient.from('dance_versions').update({ walkthrough: longWalkthrough }).eq('id', versionRow.id)

    // Already signed in via the shared storageState (see playwright.config.ts).
    await page.goto(`/dances/${danceId}/walkthrough`)
    await page.getByText('Paragraph 1 of a long e2e test walkthrough.').click()

    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' })
    const saveButton = page.getByRole('button', { name: 'Save' })
    await expect(toolbar).toBeVisible()
    await expect(saveButton).toBeVisible()

    // The whole point of fillHeight: the page itself doesn't grow to fit
    // this much content - only the editor's own content area does. A
    // generous tolerance for browser-chrome/subpixel differences between
    // scrollHeight and the reported viewport size - still far smaller than
    // the thousands of extra pixels 60 paragraphs would add if this were
    // actually broken.
    // locator.evaluate, not page.evaluate: its callback parameter comes
    // pre-typed as an element by Playwright itself, unlike page.evaluate's
    // callback body, which would need the DOM lib this project's e2e
    // tsconfig deliberately excludes (these files run in Node, not a
    // browser - only a page.evaluate callback's *body* actually executes
    // in one, and TypeScript has no way to know that on its own).
    const documentHeight = await page.locator('html').evaluate((html) => html.scrollHeight)
    const viewportHeight = page.viewportSize()?.height ?? 0
    expect(documentHeight).toBeLessThanOrEqual(viewportHeight + 20)

    // And that bounded space is genuinely scrollable, not just clipping
    // the overflow - its content is taller than what's visible. The actual
    // overflow-y-auto element is EditorContent's own wrapper (the
    // contenteditable's parent), not the contenteditable itself, which just
    // renders at its full, unbounded content height.
    const editorScroll = await page.locator('[contenteditable="true"]').evaluate((editor) => ({
      scrollHeight: editor.parentElement!.scrollHeight,
      clientHeight: editor.parentElement!.clientHeight,
    }))
    expect(editorScroll.scrollHeight).toBeGreaterThan(editorScroll.clientHeight)

    // Not just present in the DOM (toBeVisible above already covers that) -
    // specifically still within the viewport, not scrolled out of it by
    // all that content.
    await expect(toolbar).toBeInViewport()
    await expect(saveButton).toBeInViewport()
  } finally {
    // Reset so the next run starts from the same known state, regardless
    // of whether this run passed or failed.
    await verificationClient.from('dance_versions').update({ walkthrough: originalWalkthrough }).eq('id', versionRow.id)
  }
})
