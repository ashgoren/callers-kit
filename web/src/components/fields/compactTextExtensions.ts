import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontSize } from '@tiptap/extension-text-style/font-size'

// Shared Tiptap setup for short, single-purpose rich text - bold/italic/
// underline/font-size, nothing else (no headings/lists/horizontal rule/
// strike/links). For EditableFigureText & cues grid.

// The old app stored font size as size="2"/"3"/"4" on a legacy <font> tag -
// 2 and 4 map to these exact em values, checked directly against its own
// CSS (font[size="2"] { font-size: 0.8em }, font[size="4"] { font-size:
// 1.25em }); size 3 was its unstyled default, so it needs no mapping here.
const LEGACY_FONT_SIZE_EM: Record<string, string> = {
  '2': '0.8em',
  '4': '1.25em',
}

// TextStyle only parses the modern <span style="font-size:...">; extended
// here to also recognize the old app's legacy <font size="2"|"4"> tags as
// the same mark, so existing content (real production dances already have
// this) renders and re-edits correctly with no data migration needed - the
// same kind of dual-parsing Tiptap's own Bold/Italic already do for
// <strong>/<b>.
const CompatTextStyle = TextStyle.extend({
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        tag: 'font[size]',
        getAttrs: (element: HTMLElement) => (LEGACY_FONT_SIZE_EM[element.getAttribute('size') ?? ''] ? {} : false),
      },
    ]
  },
})

const CompatFontSize = FontSize.extend({
  addGlobalAttributes() {
    const parentAttributes = this.parent?.() ?? []
    return parentAttributes.map((entry) => {
      const modernParseHTML = entry.attributes.fontSize?.parseHTML
      return {
        ...entry,
        attributes: {
          ...entry.attributes,
          fontSize: {
            ...entry.attributes.fontSize,
            parseHTML: (element: HTMLElement): string | null =>
              element.tagName === 'FONT'
                ? (LEGACY_FONT_SIZE_EM[element.getAttribute('size') ?? ''] ?? null)
                : ((modernParseHTML?.(element) as string | null | undefined) ?? null),
          },
        },
      }
    })
  },
})

export const COMPACT_TEXT_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: false,
  }),
  CompatTextStyle,
  CompatFontSize,
]

export type FontSizeOption = 'Small' | 'Normal' | 'Large'

export const FONT_SIZE_EM: Record<FontSizeOption, string | null> = {
  Small: '0.8em',
  Normal: null,
  Large: '1.25em',
}

export function fontSizeOptionFor(em: string | null | undefined): FontSizeOption {
  if (em === '0.8em') return 'Small'
  if (em === '1.25em') return 'Large'
  return 'Normal'
}
