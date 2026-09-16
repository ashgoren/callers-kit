import createDOMPurify from 'dompurify'

const purify = createDOMPurify()

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html)
}

// A plain-text preview of rich HTML content, for contexts that can't render
// markup - a truncated, single-line table cell, say. Closing block tags
// and <br>s are turned into a space before the remaining markup is stripped.
export function htmlToPlainText(html: string): string {
  const withBlockBreaksAsSpaces = html.replace(/<\/(p|li|h[1-6]|div)>|<br\s*\/?>/gi, ' ')
  return purify.sanitize(withBlockBreaksAsSpaces, { ALLOWED_TAGS: [] }).replace(/\s+/g, ' ').trim()
}
