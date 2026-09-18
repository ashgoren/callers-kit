import { Toolbar } from '@/components/fields/tiptapShared'
import { buildSeparatorItem, useBoldItalicUnderlineItems, useFontSizeItems } from '@/components/fields/toolbarItems'
import type { Editor } from '@tiptap/react'

// Formatting controls for whichever cue cell is currently being edited -
// rendered once above the grid rather than per-cell, same as FigureToolbar.
// Adds one item FigureToolbar doesn't have: toggling a cell's "separator"
// (a grouping divider line after it) - see buildSeparatorItem's own
// comment in toolbarItems.tsx for why that one isn't a Tiptap command.
export function CueToolbar({ editor, hasSeparator, onToggleSeparator, className }: {
  editor: Editor
  hasSeparator: boolean
  onToggleSeparator: () => void
  className?: string
}) {
  const markItems = useBoldItalicUnderlineItems(editor)
  const sizeItems = useFontSizeItems(editor)

  return (
    <Toolbar
      editor={editor}
      groups={[markItems, sizeItems, [buildSeparatorItem(hasSeparator, onToggleSeparator)]]}
      className={className}
    />
  )
}
