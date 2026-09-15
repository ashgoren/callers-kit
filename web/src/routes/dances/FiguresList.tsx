import { Fragment } from 'react'
import { isFigureEntry } from '@/lib/figures'
import { mutedPlaceholder } from '@/lib/format'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { FigureItem } from '@/lib/figures'

// Pairs each item with whether its phrase heading should show - a figure's
// phrase changing from the previous *figure* (an interspersed note doesn't
// count as a change, so a figure repeating the same phrase right after a
// note still suppresses the heading). A plain function, not part of the
// component body, since React Compiler disallows mutating a variable across
// render - this only mutates its own local accumulator, not render state.
function withPhraseHeadings(items: FigureItem[]): { item: FigureItem; showPhraseHeading: boolean }[] {
  let lastPhrase: string | null = null
  return items.map((item) => {
    if (!isFigureEntry(item)) return { item, showPhraseHeading: false }
    const showPhraseHeading = item.phrase !== lastPhrase
    lastPhrase = item.phrase
    return { item, showPhraseHeading }
  })
}

// Renders one dance version's figures list as a phrase/beats/description
// grid - each figure keeps its own beats count even when its phrase repeats
// from the row above, only the phrase label itself is suppressed on repeat.
// All cells are direct grid children (not nested per-row wrappers) so a
// single grid-template-columns applies down the whole list rather than
// resetting per row.
export function FiguresList({ items }: { items: FigureItem[] }) {
  if (items.length === 0) return mutedPlaceholder

  return (
    <div className="grid grid-cols-[auto_auto_1fr] gap-x-6 gap-y-2 text-base">
      {withPhraseHeadings(items).map(({ item, showPhraseHeading }) => {
        if (!isFigureEntry(item)) {
          return (
            <div
              key={item.id}
              className="col-span-3 pt-3 text-muted-foreground italic"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.text) }}
            />
          )
        }

        return (
          <Fragment key={item.id}>
            <div className={`text-muted-foreground ${showPhraseHeading ? 'pt-3 font-semibold' : ''}`}>
              {showPhraseHeading ? item.phrase : null}
            </div>
            <div className={`text-muted-foreground ${showPhraseHeading ? 'pt-3' : ''}`}>
              {item.beats !== null ? `(${item.beats})` : null}
            </div>
            <div
              className={showPhraseHeading ? 'pt-3' : ''}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
            />
          </Fragment>
        )
      })}
    </div>
  )
}
