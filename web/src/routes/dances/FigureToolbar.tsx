import { Toolbar } from '@/components/fields/tiptapShared'
import { useBoldItalicUnderlineItems, useFontSizeItems } from '@/components/fields/toolbarItems'
import type { Editor } from '@tiptap/react'

// Formatting controls for whichever figure/note is currently being edited -
// rendered once in the versions box header rather than per-instance.
export function FigureToolbar({ editor, className }: { editor: Editor; className?: string }) {
  const markItems = useBoldItalicUnderlineItems(editor)
  const sizeItems = useFontSizeItems(editor)

  return (
    <Toolbar
      editor={editor}
      groups={[markItems, sizeItems]}
      className={className}
    />
  )
}
