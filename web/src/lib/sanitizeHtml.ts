import createDOMPurify from 'dompurify'

const purify = createDOMPurify()

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html)
}
