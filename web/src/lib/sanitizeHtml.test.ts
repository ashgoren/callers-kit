// @vitest-environment jsdom
//
// Overrides this project's default node environment for .test.ts files -
// sanitizeHtml wraps DOMPurify, which needs a real window/document to
// function at all (it silently no-ops otherwise), so this one file is a
// genuine exception to "pure-logic .test.ts files don't need a DOM."
import { describe, expect, it } from 'vitest'
import { htmlToPlainText, sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('keeps ordinary prose markup untouched', () => {
    const html = '<p>Circle left <strong>4 beats</strong>, then <em>swing</em>.</p>'

    expect(sanitizeHtml(html)).toBe(html)
  })

  it('strips a script tag entirely', () => {
    expect(sanitizeHtml('<p>Hey</p><script>alert(1)</script>')).toBe('<p>Hey</p>')
  })

  it('strips an inline event handler attribute, keeping the element', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">')
  })

  it('strips a javascript: URL from a link', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">Click</a>')).toBe('<a>Click</a>')
  })

  it('strips an iframe entirely', () => {
    expect(sanitizeHtml('<p>Notes</p><iframe src="https://evil.example"></iframe>')).toBe('<p>Notes</p>')
  })
})

describe('htmlToPlainText', () => {
  it('strips tags while keeping the text', () => {
    expect(htmlToPlainText('<p>Circle left <strong>4 beats</strong>.</p>')).toBe('Circle left 4 beats.')
  })

  it('inserts a space at paragraph/list/heading boundaries, instead of running adjacent blocks together', () => {
    const html = '<p>Bring extra chairs.</p><ul><li>One</li><li>Two</li></ul><p><strong>Bold</strong> note.</p>'

    expect(htmlToPlainText(html)).toBe('Bring extra chairs. One Two Bold note.')
  })

  it('treats <br> the same as a block boundary', () => {
    expect(htmlToPlainText('Line one<br>Line two')).toBe('Line one Line two')
  })

  it('collapses runs of whitespace produced by adjacent block boundaries into one space', () => {
    expect(htmlToPlainText('<p>One</p><p></p><p>Two</p>')).toBe('One Two')
  })

  it('strips a script tag and its content, not just the tag', () => {
    expect(htmlToPlainText('<p>Hey</p><script>alert(1)</script>')).toBe('Hey')
  })

  it('returns an empty string for a document with no real content', () => {
    expect(htmlToPlainText('<p></p>')).toBe('')
  })
})
