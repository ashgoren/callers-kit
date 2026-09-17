import { EditorContent, useEditor } from '@tiptap/react'
import { cn } from 'cn'
import { useLayoutEffect } from 'react'
import { useDraftFieldEdit } from '@/hooks/useDraftFieldEdit'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { COMPACT_TEXT_EXTENSIONS } from './compactTextExtensions'
import { InlineEditableField } from './InlineEditableField'
import { currentHtml } from './tiptapShared'
import type { Editor } from '@tiptap/react'
import type { ElementType, KeyboardEvent, RefObject } from 'react'

// A rich-text inline-editable field for a figure's description/note text -
// a single short line, not a whole paragraph. Blur/Enter-commits like other
// short fields. Has no formatting controls of its own - onActiveChange
// reports the live editor instance up to a shared toolbar rendered
// elsewhere (see FigureToolbar), since only one figure is ever mid-edit at
// a time and a single fixed toolbar can serve them all rather than each
// field carrying its own bubble menu. Every control in FigureToolbar is
// a plain button that returns focus here immediately, so from this field's
// perspective a toolbar click never looks any different from clicking
// nothing at all.
export function EditableFigureText({ value, onCommit, onActiveChange, placeholder = 'Add text…', as = 'span', className }: {
  value: string | null
  onCommit: (value: string | null) => void
  onActiveChange?: (editor: Editor | null) => void
  placeholder?: string
  as?: ElementType
  className?: string
}) {
  const normalizedValue = value === '' ? null : value
  const fieldEdit = useDraftFieldEdit({ value: normalizedValue, onCommit })

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      renderDisplay={(v) =>
        v === null ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(v) }} />
        )
      }
      renderInput={({ draft, onChange, onBlur, onKeyDown, ref }) => (
        <FigureTextEditArea
          draft={draft}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onActiveChange={onActiveChange}
          placeholder={placeholder}
          className={className}
          ref={ref}
        />
      )}
    />
  )
}

function FigureTextEditArea({ draft, onChange, onBlur, onKeyDown, onActiveChange, placeholder, className, ref }: {
  draft: string | null
  onChange: (value: string | null) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent) => void
  onActiveChange?: (editor: Editor | null) => void
  placeholder: string
  className?: string
  ref: RefObject<HTMLElement | null>
}) {
  const editor = useEditor({
    extensions: COMPACT_TEXT_EXTENSIONS,
    content: draft ?? '',
    onUpdate: ({ editor }) => onChange(currentHtml(editor)),
  })

  // Same reasoning as EditableRichText's own identical effect - runs
  // synchronously in the same commit as the tap that opened this field, so
  // mobile browsers still treat the resulting focus as a direct result of
  // user interaction and raise the on-screen keyboard.
  useLayoutEffect(() => {
    editor?.commands.focus('end')
  }, [editor])

  if (!editor) return null

  // Shift+Enter must reach Tiptap's own hard-break handling untouched -
  // only a plain Enter commits (matching every other short field, where
  // Enter finishing the edit is expected, not starting a new line).
  // useDraftFieldEdit's own Enter/Escape handling (invoked below via
  // onKeyDown) closes the field directly, without ever firing a native
  // blur on this div - so this is the only place that sees it happen and
  // can tell the toolbar to go away too.
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.shiftKey) return
    if (e.key === 'Enter' || e.key === 'Escape') onActiveChange?.(null)
    onKeyDown(e)
  }

  function handleBlur() {
    onActiveChange?.(null)
    onBlur()
  }

  return (
    <div
      ref={ref as RefObject<HTMLDivElement | null>}
      className={cn('rounded-lg border border-input bg-transparent px-2.5 py-1', className)}
      onKeyDownCapture={handleKeyDown}
      onFocus={() => onActiveChange?.(editor)}
      onBlur={handleBlur}
    >
      <EditorContent editor={editor} className="outline-none [&_.ProseMirror]:outline-none" placeholder={placeholder} />
    </div>
  )
}
