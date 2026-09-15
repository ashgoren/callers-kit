// @vitest-environment jsdom
//
// Overrides this project's default node environment for .test.ts files -
// sanitizeHtml wraps DOMPurify, which needs a real window/document to
// function at all (it silently no-ops otherwise), so this one file is a
// genuine exception to "pure-logic .test.ts files don't need a DOM."
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

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
