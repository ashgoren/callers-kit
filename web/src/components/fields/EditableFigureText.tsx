import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { cn } from 'cn'
import { BoldIcon, ItalicIcon, UnderlineIcon } from 'lucide-react'
import { useLayoutEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDraftFieldEdit } from '@/hooks/useDraftFieldEdit'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { COMPACT_TEXT_EXTENSIONS, FONT_SIZE_EM, fontSizeOptionFor } from './compactTextExtensions'
import { InlineEditableField } from './InlineEditableField'
import { currentHtml, ToolbarButton } from './tiptapShared'
import type { Editor } from '@tiptap/react'
import type { FontSizeOption } from './compactTextExtensions'
import type { ElementType, KeyboardEvent, RefObject } from 'react'

// A rich-text inline-editable field for a figure's description/note text -
// a single short line, not a whole paragraph. Blur/Enter-commits like other
// short fields. Formatting is a selection-triggered bubble menu.
export function EditableFigureText({ value, onCommit, placeholder = 'Add text…', as = 'span', className }: {
  value: string | null
  onCommit: (value: string | null) => void
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
          placeholder={placeholder}
          className={className}
          ref={ref}
        />
      )}
    />
  )
}

function FigureTextEditArea({ draft, onChange, onBlur, onKeyDown, placeholder, className, ref }: {
  draft: string | null
  onChange: (value: string | null) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent) => void
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
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.shiftKey) return
    onKeyDown(e)
  }

  return (
    <div
      ref={ref as RefObject<HTMLDivElement | null>}
      className={cn('rounded-lg border border-input bg-transparent px-2.5 py-1', className)}
      onKeyDownCapture={handleKeyDown}
      onBlur={onBlur}
    >
      <FigureTextBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="outline-none [&_.ProseMirror]:outline-none" placeholder={placeholder} />
    </div>
  )
}

function FigureTextBubbleMenu({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      fontSize: fontSizeOptionFor(e.getAttributes('textStyle').fontSize as string | null | undefined),
    }),
  })

  function applyFontSize(option: FontSizeOption | null) {
    const em = option ? FONT_SIZE_EM[option] : null
    if (em === null) {
      editor.chain().focus().unsetFontSize().run()
    } else {
      editor.chain().focus().setFontSize(em).run()
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      role="toolbar"
      aria-label="Text formatting"
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <ToolbarButton editor={editor} active={state.bold} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton editor={editor} active={state.italic} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        active={state.underline}
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </ToolbarButton>
      <Select value={state.fontSize} onValueChange={applyFontSize}>
        <SelectTrigger className="h-7 w-18 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Small">Small</SelectItem>
          <SelectItem value="Normal">Normal</SelectItem>
          <SelectItem value="Large">Large</SelectItem>
        </SelectContent>
      </Select>
    </BubbleMenu>
  )
}
