import { afterEach, describe, expect, it } from 'vitest'
import { hasUnsavedRichText, setRichTextFieldDirty } from './unsavedRichText'

// The registry is plain module state, not React state - shared across every
// test in this file, so each one cleans up after itself rather than relying
// on a reset between tests.
afterEach(() => {
  setRichTextFieldDirty('a', false)
  setRichTextFieldDirty('b', false)
})

describe('unsavedRichText', () => {
  it('reports no unsaved content when nothing has registered as dirty', () => {
    expect(hasUnsavedRichText()).toBe(false)
  })

  it('reports unsaved content once a field registers as dirty', () => {
    setRichTextFieldDirty('a', true)

    expect(hasUnsavedRichText()).toBe(true)
  })

  it('reports no unsaved content again once that field clears its own dirty flag', () => {
    setRichTextFieldDirty('a', true)
    setRichTextFieldDirty('a', false)

    expect(hasUnsavedRichText()).toBe(false)
  })

  it('stays true while at least one of several fields is still dirty', () => {
    setRichTextFieldDirty('a', true)
    setRichTextFieldDirty('b', true)
    setRichTextFieldDirty('a', false)

    expect(hasUnsavedRichText()).toBe(true)
  })

  it('is idempotent - marking the same id dirty twice, or clean twice, does not corrupt the count', () => {
    setRichTextFieldDirty('a', true)
    setRichTextFieldDirty('a', true)
    setRichTextFieldDirty('a', false)
    setRichTextFieldDirty('a', false)

    expect(hasUnsavedRichText()).toBe(false)
  })
})
