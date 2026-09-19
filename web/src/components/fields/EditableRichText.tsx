import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { cn } from 'cn'
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSaveCancelFieldEdit } from '@/hooks/useSaveCancelFieldEdit'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { setRichTextFieldDirty } from '@/lib/unsavedRichText'
import { buildHorizontalRuleItem, useBoldItalicUnderlineItems, useHeadingAndListItems } from './toolbarItems'
import { currentHtml, Toolbar, ToolbarBubbleMenu, useFocusEditorOnMount } from './tiptapShared'
import type { Editor } from '@tiptap/react'
import type { KeyboardEvent, RefObject } from 'react'

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

// A rich-text field for freeform notes-length content - Dance/Program notes,
// walkthrough, and cue notes. Unlike other Editable* fields, this one only enters
// edit mode via its own dedicated button.  Getting out is likewise always deliberate
// (Save/Cancel/Escape).
export function EditableRichText({
  value,
  onCommit,
  fieldName,
  placeholder = 'No notes yet',
  className,
  size = 'sm',
  fillHeight = false,
}: {
  value: string | null
  onCommit: (value: string | null) => void
  fieldName: string // drives aria-label and resume-editing pill label
  placeholder?: string
  className?: string
  size?: 'sm' | 'base'
  // Fills (and scrolls within) whatever height its container provides in
  // edit mode, instead of the default fixed max-height - see
  // DanceWalkthroughPage.tsx, whose own layout gives this room to grow up
  // to the remaining viewport height. Desktop (sm: and up) only - below
  // that breakpoint this field always grows normally with its content
  // regardless of fillHeight, letting the whole page scroll: a bounded,
  // internally-scrolling box doesn't get a mobile browser's native
  // "scroll the focused input above the keyboard" treatment the way
  // top-level page scrolling does, so keeping it bounded on mobile just
  // traded one keyboard-covers-the-cursor bug for a worse one.
  fillHeight?: boolean
}) {
  const normalizedValue = value === '' ? null : value
  const fieldEdit = useSaveCancelFieldEdit({ value: normalizedValue, onCommit })
  const errorId = useId()

  if (fieldEdit.isFocused) {
    return (
      <div className={fillHeight ? 'sm:flex sm:h-full sm:flex-col' : undefined}>
        <RichTextEditArea
          draft={fieldEdit.draft}
          onSave={fieldEdit.onChange}
          onSaveWithoutClosing={fieldEdit.saveWithoutClosing}
          onCancel={fieldEdit.attemptCancel}
          onKeyDown={fieldEdit.onKeyDown}
          hasError={fieldEdit.error !== null}
          errorId={errorId}
          placeholder={placeholder}
          className={className}
          size={size}
          fillHeight={fillHeight}
          resumeLabel={`Resume editing ${fieldName}`}
        />
        {fieldEdit.error !== null && (
          <p id={errorId} className="mt-1 text-xs text-destructive">
            {fieldEdit.error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex items-start gap-1', className)}>
      <div className="min-w-0 flex-1">
        {fieldEdit.draft === null ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <div
            className={cn('prose max-w-none', size === 'sm' && 'prose-sm')}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(fieldEdit.draft) }}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${fieldName}`}
        onClick={fieldEdit.onFocus}
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  )
}

function RichTextEditArea({
  draft,
  onSave,
  onSaveWithoutClosing,
  onCancel,
  onKeyDown,
  hasError,
  errorId,
  placeholder,
  className,
  size,
  fillHeight,
  resumeLabel,
}: {
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
  fillHeight: boolean
  resumeLabel: string
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

  // Focuses the editor as soon as it mounts - entry is always via the
  // button above rather than a click on specific content.
  useFocusEditorOnMount(editor)

  // Content this long can grow the whole box (toolbar + content +
  // Save/Cancel) taller than what was on screen at the point of the click
  // that opened it, pushing Save/Cancel below the fold - block: 'nearest'
  // only scrolls the minimum amount needed to reveal whatever part is cut
  // off. Desktop (sm: and up) only because it doesn't work on mobile.
  useLayoutEffect(() => {
    if (window.matchMedia?.('(min-width: 640px)')?.matches) {
      wrapperRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
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
      className={cn(
        'rounded-lg border border-input bg-transparent',
        // fillHeight only takes effect at sm: and up (see the fillHeight
        // prop's own comment on EditableRichText) - below that breakpoint
        // this box always grows with its content and the page scrolls.
        fillHeight && 'sm:flex sm:min-h-0 sm:flex-1 sm:flex-col',
        className,
      )}
      onKeyDownCapture={handleKeyDown}
    >
      <FullToolbar editor={editor} />
      <SelectionBubbleMenu editor={editor} />
      <EditorContent
        editor={editor}
        // No height/overflow bound below sm: at all - this grows with its
        // content like any other block element, and the whole page scrolls
        // to bring the cursor into view (the browser's own native
        // behavior for a focused, scrollable-into-view element). At sm:
        // and up, fillHeight decides between filling the page's own
        // remaining height or a fixed max-height.
        className={cn(
          'prose max-w-none px-2.5 py-1 outline-none [&_.ProseMirror]:outline-none',
          fillHeight ? 'sm:min-h-0 sm:flex-1 sm:overflow-y-auto' : 'sm:max-h-96 sm:overflow-y-auto',
          size === 'sm' ? 'prose-sm text-base md:text-sm' : 'text-base',
        )}
        placeholder={placeholder}
      />
      <SaveCancelButtons editor={editor} draft={draft} hasError={hasError} onSave={onSave} onCancel={onCancel} />
      <ResumeEditingPill editor={editor} draft={draft} wrapperRef={wrapperRef} label={resumeLabel} />
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

// This watches for scrolling the editor out of view and surfaces a way back,
// pointing toward whichever direction it actually scrolled off in. Its own
// useEditorState call, separate from SaveCancelButtons's identical-looking
// one, is deliberate - same reasoning as that one's own comment: each
// sibling subscribes to its own slice of editor state rather than lifting
// isDirty up, since editor is a stable reference React itself never sees
// change.
function ResumeEditingPill({
  editor,
  draft,
  wrapperRef,
  label,
}: {
  editor: Editor
  draft: string | null
  wrapperRef: RefObject<HTMLDivElement | null>
  label: string
}) {
  const isDirty = useEditorState({ editor, selector: () => currentHtml(editor) !== draft })
  // null means "on screen, nothing to show" - collapses that state and
  // which way it's off-screen into one value instead of two.
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (!isDirty) return
    const node = wrapperRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      setDirection(entry.isIntersecting ? null : entry.boundingClientRect.top < 0 ? 'up' : 'down')
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [isDirty, wrapperRef])

  if (!isDirty || direction === null) return null

  const DirectionIcon = direction === 'up' ? ArrowUp : ArrowDown

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="fixed right-4 bottom-4 z-50 shadow-lg"
      onClick={() => wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
    >
      <DirectionIcon className="size-4" />
      {label}
    </Button>
  )
}
