/* eslint-disable react-refresh/only-export-components -- shared module intentionally exports non-component helpers alongside ToolbarButton */
import { BubbleMenu } from '@tiptap/react/menus'
import { cn } from 'cn'
import { Fragment, useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { Editor } from '@tiptap/react'
import type { MouseEvent, ReactNode, RefObject } from 'react'

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

// A click landing directly on an edit area's own wrapper - its padding,
// not the actual contenteditable text - would otherwise blur the field
export function preventBlurOnWrapperClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) {
    e.preventDefault()
  }
}

// Click-to-position cursor: every Editable* field replaces its read-mode
// display with a freshly-mounted Tiptap editor on click, which - unlike a
// plain <input>, whose native focus-follows-click behavior comes for free -
// has no memory of where that click actually landed, and used to always
// just focus at the end of the text regardless. These four pieces (below)
// resolve that: capture a click position against the read-mode display
// (which is about to be replaced), then apply it once the editor mounts.

// A click position, captured while the read-mode display is still on
// screen: either a plain character offset within its text (a caret
// position the browser could resolve), or 'start'/'end' when the click
// landed outside the display entirely (its padding/border, beyond the
// actual text) - closer to one edge or the other of the display's own
// bounding box. null means no click was captured at all (the field was
// opened via keyboard instead).
export type ClickPosition = number | 'start' | 'end' | null

// caretPositionFromPoint is the standards-track API; caretRangeFromPoint is
// the older, WebKit-originated equivalent, kept as a fallback for any
// browser that only has the latter. Both just report "what would the text
// caret be at this screen point", via a slightly different return shape.
function caretPositionAtPoint(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }
  return null
}

// Converts a screen point into a plain character offset within root's own
// text content (not a DOM node/offset pair, which is meaningless once this
// read-mode element is gone) - counts every character of every text node
// that comes before the one the browser's own caret lookup landed in, plus
// its offset within that node. Returns null if the point didn't resolve to
// anywhere inside root at all (e.g. no browser support for either caret
// API, or the point fell outside it).
function characterOffsetAtPoint(root: Node, x: number, y: number): number | null {
  const caret = caretPositionAtPoint(x, y)
  if (!caret || !root.contains(caret.node)) return null
  const { node: caretNode, offset: caretOffset } = caret

  let offset = 0
  let found = false
  function walk(node: Node) {
    if (found) return
    if (node === caretNode) {
      offset += caretOffset
      found = true
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0
      return
    }
    node.childNodes.forEach(walk)
  }
  walk(root)
  return found ? offset : null
}

// Which edge of root a point falls closest to when it's outside root's own
// text entirely (characterOffsetAtPoint returned null - e.g. a click in
// the field's padding/border, beyond the actual glyphs) - above or to the
// left of everything should still open at the start, not silently fall
// all the way back to the end the way a genuinely unresolvable click does.
function fallbackEdgeForPoint(root: Element, x: number, y: number): 'start' | 'end' {
  const rect = root.getBoundingClientRect()
  if (y < rect.top) return 'start'
  if (y > rect.bottom) return 'end'
  return x < rect.left ? 'start' : 'end'
}

// Captures a click's position against whatever read-mode display it fires
// on - meant for a mousedown handler passed to InlineEditableField's own
// onMouseDown (its actual clickable area, not just whatever renderDisplay
// happens to render inside it - a handler attached only to a narrower
// display element, like a short word centered in a wider fixed-width
// cell, would miss every click that lands in the surrounding click target
// instead). The returned ref is read (and cleared) once by
// useFocusAtClickPosition below, in whatever component mounts the actual
// editor - a ref, not state, since this value is consumed exactly once and
// never rendered from directly.
export function useCapturedClickPosition(): { clickPositionRef: RefObject<ClickPosition>; handleMouseDown: (e: MouseEvent) => void } {
  const clickPositionRef = useRef<ClickPosition>(null)
  function handleMouseDown(e: MouseEvent) {
    const charOffset = characterOffsetAtPoint(e.currentTarget, e.clientX, e.clientY)
    const fallback = fallbackEdgeForPoint(e.currentTarget, e.clientX, e.clientY)
    clickPositionRef.current = charOffset ?? fallback
  }
  return { clickPositionRef, handleMouseDown }
}

// Maps a plain character offset (counted the same way characterOffsetAtPoint
// counts it - straight through every text node in document order, ignoring
// block structure entirely) onto a real ProseMirror document position,
// which does have to account for that structure (a position between two
// paragraphs, say, isn't just "one more than the last character" - entering
// and leaving each node consumes a position of its own). Doing this
// generally, via the document's own node tree, rather than assuming a
// fixed shape, is what lets the exact same click-to-position logic serve
// both a single-paragraph compact field and a full multi-paragraph/
// heading/list one without each needing its own version of this math.
function textOffsetToDocPos(doc: Editor['state']['doc'], textOffset: number): number {
  let remaining = textOffset
  let resolvedPos: number | null = null
  doc.descendants((node, pos) => {
    if (resolvedPos !== null) return false
    if (!node.isText) return true
    const length = node.text?.length ?? 0
    if (remaining <= length) {
      resolvedPos = pos + remaining
      return false
    }
    remaining -= length
    return true
  })
  return resolvedPos ?? doc.content.size
}

// Applies a captured click position once editor actually exists, in the
// same layout effect timing every Editable* field already used to
// unconditionally focus('end') - synchronously in the same commit as the
// click that opened the field, so mobile browsers still treat the
// resulting focus as a direct result of user interaction and raise the
// on-screen keyboard. hasFocusedRef guards against React StrictMode's
// dev-only double-invocation of this effect (confirmed directly once: the
// first run correctly focused the clicked character, then an immediate
// second run saw the ref already consumed/nulled by the first and silently
// reset it back to 'end') - without it, a real click position would be
// applied and then immediately undone again, but only in development,
// since StrictMode's double-invocation never happens in a production
// build. Local to whichever component calls this hook, so it naturally
// resets to false on each genuinely new mount. Consumes (reads once, then
// clears) clickPositionRef, so a later keyboard-opened edit of the same
// field doesn't reuse a stale value from a previous click.
export function useFocusAtClickPosition(editor: Editor | null, clickPositionRef: RefObject<ClickPosition>): void {
  const hasFocusedRef = useRef(false)
  useLayoutEffect(() => {
    if (!editor || hasFocusedRef.current) return
    hasFocusedRef.current = true
    const clickPosition = clickPositionRef.current
    clickPositionRef.current = null
    const pos =
      typeof clickPosition === 'number'
        ? Math.min(textOffsetToDocPos(editor.state.doc, clickPosition), editor.state.doc.content.size)
        : (clickPosition ?? 'end')
    editor.commands.focus(pos)
  }, [editor, clickPositionRef])
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
// from these can mix in an action that isn't a text command at all (e.g.
// cues-grid button toggling a cell border).
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
