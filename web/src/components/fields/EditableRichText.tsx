import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { cn } from 'cn'
import { BoldIcon, Heading1Icon, Heading2Icon, ItalicIcon, ListIcon, MinusIcon, UnderlineIcon } from 'lucide-react'
import { useEffect, useId, useLayoutEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useSaveCancelFieldEdit } from '@/hooks/useSaveCancelFieldEdit'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { setRichTextFieldDirty } from '@/lib/unsavedRichText'
import { InlineEditableField } from './InlineEditableField'
import type { Editor } from '@tiptap/react'
import type { ElementType, KeyboardEvent, ReactNode } from 'react'

// The "full" toolbar - Bold, Italic, Underline, H1/H2, list, and a divider.
const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2] }, orderedList: false, link: { openOnClick: false } }),
  Placeholder.configure({ placeholder: 'Add a note…' }),
]

// Tiptap's getHTML() on an empty document returns "<p></p>", not "" -
// normalized to null here so untouched empty field reads as "nothing to save".
function currentHtml(editor: Editor): string | null {
  return editor.isEmpty ? null : sanitizeHtml(editor.getHTML())
}

function ToolbarButton({ editor, active, label, onClick, children }: {
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

function Toolbar({ editor }: { editor: Editor }) {
  // useEditorState, not editor.isActive(...) called directly in JSX -
  // editor is a stable reference across renders, so React Compiler's
  // auto-memoization can otherwise serve a stale active-state result after
  // a selection/mark change that didn't also change this component's own
  // props/state.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      heading1: e.isActive('heading', { level: 1 }),
      heading2: e.isActive('heading', { level: 2 }),
      bulletList: e.isActive('bulletList'),
    }),
  })

  return (
    <div className="flex items-center gap-0.5 border-b border-input p-1">
      <ToolbarButton editor={editor} active={state.bold} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={state.italic} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={state.underline} label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={state.heading1} label="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1Icon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={state.heading2} label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2Icon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={state.bulletList} label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={false} label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <MinusIcon />
      </ToolbarButton>
    </div>
  )
}

// A rich-text inline-editable field, for freeform notes-length content -
// Dance/Program notes and walkthrough. A read-only, sanitized-HTML display
// until clicked/tapped, then a real Tiptap editor with the toolbar above
// and an explicit Save/Cancel row below.
export function EditableRichText({ value, onCommit, placeholder = 'No notes yet', as = 'div', className }: {
  value: string | null
  onCommit: (value: string | null) => void
  placeholder?: string
  as?: ElementType
  className?: string
}) {
  const normalizedValue = value === '' ? null : value
  const fieldEdit = useSaveCancelFieldEdit({ value: normalizedValue, onCommit })

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      renderDisplay={(v) =>
        v === null ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(v) }} />
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
        />
      )}
    />
  )
}

function RichTextEditArea({ draft, onSave, onSaveWithoutClosing, onCancel, onKeyDown, hasError, errorId, placeholder, className }: {
  draft: string | null
  onSave: (value: string | null) => void
  onSaveWithoutClosing: (value: string | null) => void
  onCancel: (current: string | null) => void
  onKeyDown: (e: KeyboardEvent) => void
  hasError: boolean
  errorId: string
  placeholder: string
  className?: string
}) {
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
      className={cn('rounded-lg border border-input bg-transparent', className)}
      onKeyDownCapture={handleKeyDown}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-2.5 py-1 text-base outline-none [&_.ProseMirror]:outline-none md:text-sm"
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
