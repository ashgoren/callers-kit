import { useEditorState } from '@tiptap/react'
import { BoldIcon, Heading1Icon, Heading2Icon, ItalicIcon, ListIcon, MinusIcon, UnderlineIcon } from 'lucide-react'
import { FONT_SIZE_EM, fontSizeOptionFor } from './compactTextExtensions'
import type { Editor } from '@tiptap/react'
import type { FontSizeOption } from './compactTextExtensions'
import type { ToolbarItem } from './tiptapShared'

// Every toolbar button's definition - what it's called, what it looks
// like, and what it does - kept separate from tiptapShared.tsx (which only
// knows how to lay a list of these out) and from the components that
// compose them into groups (EditableRichText.tsx, FigureToolbar.tsx), so
// neither has to define a button inline to use it.

// Bold/Italic/Underline - identical in both the compact and full variants,
// the one item-builder actually shared between them today (headings/lists/
// horizontal-rule are full-only; font size is compact-only).
export function useBoldItalicUnderlineItems(editor: Editor): ToolbarItem[] {
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
    }),
  })

  return [
    {
      key: 'bold',
      label: 'Bold',
      icon: <BoldIcon />,
      active: state.bold,
      onClick: () => editor.chain().focus().toggleBold().run()
    },
    {
      key: 'italic',
      label: 'Italic',
      icon: <ItalicIcon />,
      active: state.italic,
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      label: 'Underline',
      icon: <UnderlineIcon />,
      active: state.underline,
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
  ]
}

// Headings and Bullet list - full-variant only. Shown in both
// EditableRichText's fixed toolbar and its selection bubble menu,
// unlike Horizontal rule below, which only makes sense in the fixed toolbar.
export function useHeadingAndListItems(editor: Editor): ToolbarItem[] {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading1: e.isActive('heading', { level: 1 }),
      heading2: e.isActive('heading', { level: 2 }),
      bulletList: e.isActive('bulletList'),
    }),
  })

  return [
    {
      key: 'heading1',
      label: 'Heading 1',
      icon: <Heading1Icon />,
      active: state.heading1,
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: 'heading2',
      label: 'Heading 2',
      icon: <Heading2Icon />,
      active: state.heading2,
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: 'bulletList',
      label: 'Bullet list',
      icon: <ListIcon />,
      active: state.bulletList,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
  ]
}

// Horizontal rule - full-variant, fixed-toolbar-only (it inserts a new
// node rather than acting on existing content, so it's excluded from the
// selection bubble menu). A plain function rather than a hook: it inserts
// a node instead of toggling a mark/block, so it has no "active" state to
// track and needs no useEditorState subscription.
export function buildHorizontalRuleItem(editor: Editor): ToolbarItem {
  return {
    key: 'horizontalRule',
    label: 'Horizontal rule',
    icon: <MinusIcon />,
    active: false,
    onClick: () => editor.chain().focus().setHorizontalRule().run(),
  }
}

// Font size controls - compact-variant only (full variant has no equivalent).
export function useFontSizeItems(editor: Editor): ToolbarItem[] {
  const fontSize = useEditorState({
    editor,
    selector: ({ editor: e }) => fontSizeOptionFor(e.getAttributes('textStyle').fontSize as string | null | undefined),
  })

  function applyFontSize(option: FontSizeOption) {
    const em = FONT_SIZE_EM[option]
    if (em === null) {
      editor.chain().focus().unsetFontSize().run()
    } else {
      editor.chain().focus().setFontSize(em).run()
    }
  }

  return [
    {
      key: 'small',
      label: 'Small text',
      icon: <span className="text-xs font-semibold">A</span>,
      active: fontSize === 'Small',
      onClick: () => applyFontSize('Small'),
    },
    {
      key: 'normal',
      label: 'Normal text',
      icon: <span className="text-sm font-semibold">A</span>,
      active: fontSize === 'Normal',
      onClick: () => applyFontSize('Normal'),
    },
    {
      key: 'large',
      label: 'Large text',
      icon: <span className="text-base font-semibold">A</span>,
      active: fontSize === 'Large',
      onClick: () => applyFontSize('Large'),
    },
  ]
}
