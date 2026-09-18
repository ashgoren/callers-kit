import { cn } from 'cn'
import { useLayoutEffect, useRef, useState } from 'react'
import { EditableFigureText } from '@/components/fields/EditableFigureText'
import {
CELL_HEIGHT,
cellKey,
COL_WIDTH,
COLS,
GRID_NATURAL_HEIGHT,
GRID_NATURAL_WIDTH,
INTRO_COLS,
LABEL_WIDTH,
SECTIONS,
} from '@/lib/cues'
import { CueToolbar } from './CueToolbar'
import type { Editor } from '@tiptap/react'
import type { CuesData } from '@/lib/cues'

// The grid renders at a fixed natural pixel size and scales down via a CSS
// transform to fit whatever width its container actually has - this keeps
// beat columns and cell text shrinking together under one scale factor, so
// how much text wraps onto one line stays identical at any screen size.
//
// chrome varies by breakpoint (see the BOX_CHROME_* constants below) since
// the visible box's own border is itself conditional on the same sm:
// breakpoint - its padding, unlike its border, applies at every breakpoint.
function useScaleToFit(naturalWidth: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [chrome, setChrome] = useState(BOX_CHROME_BASE)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    function updateScale(containerWidth: number) {
      const isSmAndUp = window.matchMedia?.('(min-width: 640px)')?.matches ?? false
      const currentChrome = BOX_CHROME_BASE + (isSmAndUp ? BOX_CHROME_SM_BORDER : 0)
      setChrome(currentChrome)
      setScale(Math.min(1, (containerWidth - currentChrome) / naturalWidth))
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateScale(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [naturalWidth])

  return { containerRef, scale, chrome }
}

// The outer grid box's own padding, in pixels - applied at every breakpoint
// (see the box's own className below, p-2 unconditionally). The border,
// only added at sm: and up, is kept as a separate constant so mobile's
// chrome budget doesn't have to pay for a border it never renders.
const BOX_CHROME_BASE = 16 /* p-2 */
const BOX_CHROME_SM_BORDER = 2 /* border, sm: and up only */

// Each cell's own chrome, subtracted from COL_WIDTH to get the actual text
// content width - Passed to EditableFigureText as contentWidth to pin its
// edit-mode box to this same number explicitly. View mode already arrives
// at it correctly on its own (via ordinary flex/percentage layout).
const CELL_CHROME = 4 /* td p-0.5 */ + 2 /* field border */ + 2 /* field px-px */

const CELL_CONTENT_WIDTH = COL_WIDTH - CELL_CHROME

interface ActiveCell {
  key: string
  editor: Editor
}

// Every populated cell is its own compact rich-text field.
// Cells are always click-to-edit, so only the one cell currently
// focused ever has a live Tiptap instance; every other cell is plain
// sanitized HTML. One shared toolbar tracks whichever cell last
// had focus and applies formatting/separator commands to it.
export function CuesGrid({ cues, onEditCell, onToggleSeparator }: {
  cues: CuesData | null
  onEditCell: (key: string, value: string | null) => void
  onToggleSeparator: (key: string) => void
}) {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const { containerRef, scale, chrome } = useScaleToFit(GRID_NATURAL_WIDTH)

  const cells = cues?.cells ?? {}
  const separators = new Set(cues?.separators ?? [])

  function handleActiveChange(key: string, editor: Editor | null) {
    setActiveCell((current) => {
      if (editor) return { key, editor }
      // Prevent another cell's blur from clearing activeCell state if a new cell has already focused.
      return current?.key === key ? null : current
    })
  }

  function renderCell(section: string, row: number, col: number, topBorder: boolean) {
    const key = cellKey(section, row, col)
    return (
      <td
        key={col}
        style={{ height: CELL_HEIGHT, width: COL_WIDTH }}
        // Divider lines are applied to each cell of the row directly to actually show up.
        className={cn(
          'border-b border-b-transparent p-0.5',
          topBorder ? 'border-t border-t-border' : 'border-t border-t-transparent',
          separators.has(key) && 'border-r-2 border-r-border',
        )}
      >
        <EditableFigureText
          value={cells[key] ?? null}
          onCommit={(value) => onEditCell(key, value)}
          onActiveChange={(editor) => handleActiveChange(key, editor)}
          placeholder="•"
          as="div"
          className="flex h-full w-full items-center justify-center px-px py-0.5 text-center"
          contentWidth={CELL_CONTENT_WIDTH}
        />
      </td>
    )
  }

  return (
    <div>
      {/* Always occupies same height whether or not edit mode, so switching modes doesn't shift the grid. */}
      <div className="mb-1 flex h-7 items-center pointer-coarse:h-12">
        {activeCell && (
          <CueToolbar
            editor={activeCell.editor}
            hasSeparator={separators.has(activeCell.key)}
            onToggleSeparator={() => onToggleSeparator(activeCell.key)}
          />
        )}
      </div>
      {/* The measuring element (for the scale-to-fit ResizeObserver above)
          is this full-width outer div, kept separate from the visible
          bordered box - that box's own width is set explicitly to match its
          (scaled) content exactly, rather than a CSS width: fit-content. */}
      <div ref={containerRef} className="w-full">
        <div className="overflow-x-auto overflow-y-hidden p-2 sm:rounded-lg sm:border" style={{ width: GRID_NATURAL_WIDTH * scale + chrome }}>
          {/* CSS transform doesn't change an element's own layout size, only
              how it's painted - without this box clipping its child (which
              is still declared at the full, unscaled GRID_NATURAL_WIDTH),
              that child's real layout footprint would overflow this
              intentionally-smaller box. */}
          <div style={{ width: GRID_NATURAL_WIDTH * scale, height: GRID_NATURAL_HEIGHT * scale, overflow: 'hidden' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: GRID_NATURAL_WIDTH }}>
              {/* width set explicitly here, not just on the wrapping divs -
                  a <table> with no width of its own doesn't reliably fill
                  its container the way an ordinary block element does. */}
              <table className="border-separate border-spacing-0" style={{ tableLayout: 'fixed', width: GRID_NATURAL_WIDTH }}>
                <colgroup>
                  <col style={{ width: LABEL_WIDTH }} />
                  {Array.from({ length: COLS }, (_, i) => (
                    <col key={i} style={{ width: COL_WIDTH }} />
                  ))}
                </colgroup>
                <tbody>
                  {SECTIONS.flatMap((section, sectionIndex) => {
                    const topBorder = sectionIndex > 0
                    const labelCell = (
                      <td
                        key="label"
                        rowSpan={section.rows}
                        className={cn(
                          'pr-4 text-center align-top text-sm font-semibold text-muted-foreground',
                          topBorder && 'border-t border-t-border',
                        )}
                      >
                        <div style={{ height: CELL_HEIGHT }} className="flex items-center justify-center">
                          {section.label}
                        </div>
                      </td>
                    )

                    if (section.rows === 1) {
                      return [
                        <tr key={`${section.id}:0`}>
                          {labelCell}
                          <td colSpan={COLS - INTRO_COLS} />
                          {Array.from({ length: INTRO_COLS }, (_, i) => renderCell(section.id, 0, COLS - INTRO_COLS + i, false))}
                        </tr>,
                      ]
                    }

                    return [0, 1].map((row) => (
                      <tr key={`${section.id}:${row}`}>
                        {row === 0 && labelCell}
                        {Array.from({ length: COLS }, (_, col) => renderCell(section.id, row, col, row === 0 && topBorder))}
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
