/* eslint-disable react-refresh/only-export-components -- shared module intentionally exports both currentHtml and ToolbarButton */
import { Button } from '@/components/ui/button'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { Editor } from '@tiptap/react'
import type { ReactNode } from 'react'

// Shared between EditableRichText and EditableCompactRichText.

// Tiptap's getHTML() on an empty document returns "<p></p>", not "" -
// normalized to null here so untouched empty field reads as "nothing to save".
export function currentHtml(editor: Editor): string | null {
  return editor.isEmpty ? null : sanitizeHtml(editor.getHTML())
}

export function ToolbarButton({ editor, active, label, onClick, children }: {
  editor: Editor
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      className="pointer-coarse:size-12"
      aria-label={label}
      aria-pressed={active}
      // A click on this button would otherwise blur the editor before the
      // click handler runs, since the browser moves focus away from the
      // contentEditable the instant the pointer goes down elsewhere.
      onMouseDown={(e) => {
        e.preventDefault()
        editor.chain().focus()
      }}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
