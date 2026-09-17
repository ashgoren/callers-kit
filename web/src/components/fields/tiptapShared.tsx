/* eslint-disable react-refresh/only-export-components -- shared module intentionally exports non-component helpers alongside ToolbarButton */
import { BubbleMenu } from '@tiptap/react/menus'
import { cn } from 'cn'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { Editor } from '@tiptap/react'
import type { ReactNode } from 'react'

// Shared across every Tiptap-based field - both the "full" variant
// (EditableRichText, for notes-length content) and the "compact" variant
// (EditableFigureText, for a single figure/note line). Knows only how a
// toolbar lays out and renders a list of buttons - what each button is and
// does lives in toolbarItems.tsx instead.

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
      // A click on this button would otherwise blur the editor before its
      // own click handler fires, since the browser moves focus away from
      // the contentEditable the instant the pointer goes down elsewhere.
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

// One button's worth of toolbar content - deliberately not tied to Tiptap
// commands specifically (onClick is just a callback), since a toolbar built
// from these can mix in an action that isn't a text command at all (e.g. a
// future cues-grid button toggling a cell border, not a mark on the text).
export interface ToolbarItem {
  key: string
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

// Renders groups of ToolbarItems with a divider between groups.
// Callers choose which groups to pass in.
function ToolbarItemGroups({ editor, groups }: { editor: Editor; groups: ToolbarItem[][] }) {
  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group.map((item) => item.key).join('-') || index}>
          {index > 0 && <div className="mx-1 h-5 w-px self-stretch bg-border" />}
          {group.map((item) => (
            <ToolbarButton key={item.key} editor={editor} active={item.active} label={item.label} onClick={item.onClick}>
              {item.icon}
            </ToolbarButton>
          ))}
        </Fragment>
      ))}
    </>
  )
}

// A fixed toolbar, always visible while editing.
export function Toolbar({ editor, groups, className }: { editor: Editor; groups: ToolbarItem[][]; className?: string }) {
  return (
    <div role="toolbar" aria-label="Text formatting" className={cn('flex items-center gap-0.5', className)}>
      <ToolbarItemGroups editor={editor} groups={groups} />
    </div>
  )
}

// A selection-triggered bubble menu.
export function ToolbarBubbleMenu({ editor, groups, ariaLabel }: { editor: Editor; groups: ToolbarItem[][]; ariaLabel: string }) {
  return (
    <BubbleMenu
      editor={editor}
      role="toolbar"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <ToolbarItemGroups editor={editor} groups={groups} />
    </BubbleMenu>
  )
}
