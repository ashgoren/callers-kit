import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { cn } from 'cn'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useSaveCancelFieldEdit } from '@/hooks/useSaveCancelFieldEdit'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { setRichTextFieldDirty } from '@/lib/unsavedRichText'
import { InlineEditableField } from './InlineEditableField'
import { buildHorizontalRuleItem, useBoldItalicUnderlineItems, useHeadingAndListItems } from './toolbarItems'
import { currentHtml, Toolbar, ToolbarBubbleMenu } from './tiptapShared'
import type { Editor } from '@tiptap/react'
import type { ElementType, KeyboardEvent } from 'react'

// The "full" toolbar - Bold, Italic, Underline, H1/H2, list, and a divider.
const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2] }, orderedList: false, link: { openOnClick: false } }),
  Placeholder.configure({ placeholder: 'Add a note…' }),
]

function FullToolbar({ editor }: { editor: Editor }) {
  const markItems = useBoldItalicUnderlineItems(editor)
  const blockItems = useHeadingAndListItems(editor)
  return (
    <Toolbar
      editor={editor}
      groups={[markItems, blockItems, [buildHorizontalRuleItem(editor)]]}
      className="border-b border-input p-1"
    />
  )
}

function SelectionBubbleMenu({ editor }: { editor: Editor }) {
  const markItems = useBoldItalicUnderlineItems(editor)
  const blockItems = useHeadingAndListItems(editor)
  return (
    <ToolbarBubbleMenu
      editor={editor}
      groups={[markItems, blockItems]}
      ariaLabel="Selection formatting"
    />
  )
}

// A rich-text inline-editable field, for freeform notes-length content -
// Dance/Program notes and walkthrough. A read-only, sanitized-HTML display
// until clicked/tapped, then a real Tiptap editor with the toolbar above
// and an explicit Save/Cancel row below.
export function EditableRichText({ value, onCommit, placeholder = 'No notes yet', as = 'div', className, size = 'sm' }: {
  value: string | null
  onCommit: (value: string | null) => void
  placeholder?: string
  as?: ElementType
  className?: string
  size?: 'sm' | 'base'
}) {
  const normalizedValue = value === '' ? null : value
  const fieldEdit = useSaveCancelFieldEdit({ value: normalizedValue, onCommit })

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      fullWidth
      renderDisplay={(v) =>
        v === null ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <div
            className={cn('prose max-w-none', size === 'sm' && 'prose-sm')}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(v) }}
          />
        )
      }
      renderInput={({ draft, onKeyDown, hasError, errorId }) => (
        <RichTextEditArea
          draft={draft}
          onSave={fieldEdit.onChange}
          onSaveWithoutClosing={fieldEdit.saveWithoutClosing}
          onCancel={fieldEdit.attemptCancel}
          onKeyDown={onKeyDown}
          hasError={hasError}
          errorId={errorId}
          placeholder={placeholder}
          className={className}
          size={size}
        />
      )}
    />
  )
}

function RichTextEditArea({ draft, onSave, onSaveWithoutClosing, onCancel, onKeyDown, hasError, errorId, placeholder, className, size }: {
  draft: string | null
  onSave: (value: string | null) => void
  onSaveWithoutClosing: (value: string | null) => void
  onCancel: (current: string | null) => void
  onKeyDown: (e: KeyboardEvent) => void
  hasError: boolean
  errorId: string
  placeholder: string
  className?: string
  size: 'sm' | 'base'
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: draft ?? '',
    editorProps: {
      attributes: {
        'aria-invalid': hasError ? 'true' : 'false',
        ...(hasError ? { 'aria-describedby': errorId } : {}),
      },
    },
  })

  // Not Tiptap's own `autofocus` option - it defers the actual focus()
  // call via setTimeout(fn, 0), which runs after the tap that opened this
  // field has already finished. By then, mobile browsers (particularly
  // iOS Safari) no longer treat it as a direct result of user interaction
  // and won't raise the on-screen keyboard. Focusing here instead, runs
  // synchronously in the same commit the tap already triggered,
  // with no setTimeout gap - EditorContent's own mount (a class
  // component's componentDidMount, which fires at the same phase and,
  // being a child, fires first) has already attached the real
  // contentEditable node to the document by the time this runs.
  useLayoutEffect(() => {
    editor?.commands.focus('end')

    // Content this long can grow the whole box (toolbar + content +
    // Save/Cancel) taller than what was on screen at the point of the
    // click that opened it, pushing Save/Cancel below the fold - block:
    // 'nearest' only scrolls the minimum amount needed to reveal whatever
    // part is cut off.
    wrapperRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [editor])

  if (!editor) return null

  // Cmd/Ctrl-S checkpoints the current content without closing the field -
  // preventDefault stops the browser's own save dialog from opening.
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      onSaveWithoutClosing(currentHtml(editor))
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel(currentHtml(editor))
      return
    }
    onKeyDown(e)
  }

  return (
    <div
      ref={wrapperRef}
      className={cn('rounded-lg border border-input bg-transparent', className)}
      onKeyDownCapture={handleKeyDown}
    >
      <FullToolbar editor={editor} />
      <SelectionBubbleMenu editor={editor} />
      <EditorContent
        editor={editor}
        // max-h + overflow-y-auto bounds only the content itself;
        // the toolbar above and save/cancel below stay are always visible.
        // Without this, a long note just grows the whole box.
        className={cn(
          'prose max-h-96 max-w-none overflow-y-auto px-2.5 py-1 outline-none [&_.ProseMirror]:outline-none',
          size === 'sm' ? 'prose-sm text-base md:text-sm' : 'text-base',
        )}
        placeholder={placeholder}
      />
      <SaveCancelButtons editor={editor} draft={draft} hasError={hasError} onSave={onSave} onCancel={onCancel} />
    </div>
  )
}

function SaveCancelButtons({
  editor,
  draft,
  hasError,
  onSave,
  onCancel,
}: {
  editor: Editor
  draft: string | null
  hasError: boolean
  onSave: (value: string | null) => void
  onCancel: (current: string | null) => void
}) {
  // Reactive, via useEditorState rather than a plain comparison inline in
  // JSX - the same React-Compiler-staleness concern as the toolbar's
  // active states above, since editor is a stable reference that changes
  // on every keystroke without React itself seeing a prop/state change.
  // Lives in its own component (like Toolbar) rather than inline in
  // RichTextEditArea, since useEditorState needs a non-null editor and
  // can't be called after that component's own early `if (!editor)` return.
  const isDirty = useEditorState({ editor, selector: () => currentHtml(editor) !== draft })

  // Registers this field's dirtiness with the app-wide tracker AppShell
  // uses to guard navigation (useBlocker/useBeforeUnload) - this component
  // only exists while the field is actually open, so mounting/unmounting it
  // already lines up with "there's something to lose"/"there isn't"
  // without needing a separate isFocused check here.
  const id = useId()
  useEffect(() => {
    setRichTextFieldDirty(id, isDirty)
    return () => setRichTextFieldDirty(id, false)
  }, [id, isDirty])

  return (
    <div className="flex items-center justify-end gap-1.5 border-t border-input p-1.5">
      <Button
        type="button"
        variant={hasError ? 'destructive' : 'ghost'}
        size="sm"
        onClick={() => onCancel(currentHtml(editor))}
      >
        {hasError ? 'Discard' : 'Cancel'}
      </Button>
      <Button type="button" size="sm" disabled={!isDirty} onClick={() => onSave(currentHtml(editor))}>
        Save
      </Button>
    </div>
  )
}
