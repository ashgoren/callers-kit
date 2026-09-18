import { EditorContent, useEditor } from '@tiptap/react'
import { cn } from 'cn'
import { useDraftFieldEdit } from '@/hooks/useDraftFieldEdit'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { COMPACT_TEXT_EXTENSIONS } from './compactTextExtensions'
import { InlineEditableField } from './InlineEditableField'
import { currentHtml, preventBlurOnWrapperClick, useCapturedClickPosition, useFocusAtClickPosition } from './tiptapShared'
import type { Editor } from '@tiptap/react'
import type { ElementType, KeyboardEvent, RefObject } from 'react'
import type { ClickPosition } from './tiptapShared'

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
export function EditableFigureText({
  value,
  onCommit,
  onActiveChange,
  placeholder = 'Add text…',
  as = 'span',
  className,
  contentWidth,
}: {
  value: string | null
  onCommit: (value: string | null) => void
  onActiveChange?: (editor: Editor | null) => void
  placeholder?: string
  as?: ElementType
  className?: string
  contentWidth?: number // used by cues grid
}) {
  const normalizedValue = value === '' ? null : value
  const fieldEdit = useDraftFieldEdit({ value: normalizedValue, onCommit })
  const { clickPositionRef, handleMouseDown } = useCapturedClickPosition()

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      editModeClassName="h-full"
      onMouseDown={handleMouseDown}
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
          contentWidth={contentWidth}
          clickPositionRef={clickPositionRef}
          ref={ref}
        />
      )}
    />
  )
}

function FigureTextEditArea({ draft, onChange, onBlur, onKeyDown, onActiveChange, placeholder, className, contentWidth, clickPositionRef, ref }: {
  draft: string | null
  onChange: (value: string | null) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent) => void
  onActiveChange?: (editor: Editor | null) => void
  placeholder: string
  className?: string
  contentWidth?: number
  clickPositionRef: RefObject<ClickPosition>
  ref: RefObject<HTMLElement | null>
}) {
  const editor = useEditor({
    extensions: COMPACT_TEXT_EXTENSIONS,
    content: draft ?? '',
    editorProps: {
      attributes: {
        // Overrides Tiptap's default CSS that causes issues for cues grid cells.
        style: `overflow-wrap: normal; word-break: normal; white-space: normal; font-variant-ligatures: normal; font-feature-settings: normal;${contentWidth !== undefined ? ` width: ${contentWidth}px;` : ''}`,
      },
    },
    onUpdate: ({ editor }) => onChange(currentHtml(editor)),
  })

  useFocusAtClickPosition(editor, clickPositionRef)

  if (!editor) return null

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
      onMouseDown={preventBlurOnWrapperClick}
    >
      <EditorContent
        editor={editor}
        className="w-full outline-none [&_.ProseMirror]:w-full [&_.ProseMirror]:outline-none"
        placeholder={placeholder}
      />
    </div>
  )
}
