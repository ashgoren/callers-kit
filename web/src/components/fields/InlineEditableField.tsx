import { cn } from 'cn'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import type { ElementType, KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react'

// Shared across every InlineEditableField instance on the page - a single module-level flag is enough to
// coordinate them without a Context/provider. Set/read by pointerdown-capture effect below.
let suppressNextOpen = false

// Temporary on-screen debug overlay for tracking down a mobile-only bug - remove once diagnosed.
function debugLog(msg: string) {
  let el = document.getElementById('__ief_debug')
  if (!el) {
    el = document.createElement('pre')
    el.id = '__ief_debug'
    el.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:black;color:lime;font-size:10px;z-index:99999;margin:0;padding:4px;white-space:pre-wrap;'
    document.body.appendChild(el)
  }
  el.textContent = `${msg}\n${el.textContent}`.slice(0, 4000)
}

// What this shell needs to drive the view/edit toggle - deliberately not
// specific to any one commit model. useDraftFieldEdit (a local draft,
// committed at blur/Enter) is one implementation; a field whose commit
// model looks nothing like that - a select, where picking an option is
// itself an immediate commit with no separate draft to hold - implements
// its own hook returning this same shape instead.
export interface FieldEditState<T> {
  draft: T
  error: string | null
  isFocused: boolean
  onFocus: () => void
  onChange: (value: T) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent) => void
}

// The shared "click (or tap) to edit" shell every Editable* field builds on:
// a read-mode display that swaps to a real input once activated, rather
// than disguising an always-present input as plain text. Read mode keeps
// whatever semantic element the caller needs (a real <h1> for a page title,
// say) - the swap to an actual input only happens once genuinely editing,
// so there's nothing fighting the input's own preset styling to make it
// look like something else.
//
// Takes a FieldEditState<T> directly (spread in by the caller) rather than
// building one itself - this shell only cares about isFocused/draft/error
// and the handlers, not which hook or commit model produced them.
export function InlineEditableField<T>({
  draft,
  error,
  isFocused,
  onFocus,
  onChange,
  onBlur,
  onKeyDown,
  as: As = 'span',
  className,
  editModeClassName,
  fullWidth = false,
  onMouseDown,
  renderDisplay,
  renderInput,
}: FieldEditState<T> & {
  as?: ElementType
  className?: string
  editModeClassName?: string
  fullWidth?: boolean
  onMouseDown?: (e: MouseEvent) => void
  renderDisplay: (value: T) => ReactNode
  renderInput: (props: {
    draft: T
    onChange: (value: T) => void
    onBlur: () => void
    onKeyDown: (e: KeyboardEvent) => void
    hasError: boolean
    errorId: string
    ref: RefObject<HTMLElement | null>
  }) => ReactNode
}) {
  const errorId = useId()
  const inputRef = useRef<HTMLElement>(null)
  const wrapperRef = useRef<HTMLElement>(null)

  // A blur-triggered commit that fails validation stays in edit mode
  // (isFocused never flips back to false) so the error can show - but the
  // browser has already moved real focus away by the time that blur event
  // even reaches onBlur, useLayoutEffect pulls focus back before the
  // browser paints, so there's no visible flicker of it being unfocused.
  useLayoutEffect(() => {
    if (isFocused && error !== null) {
      inputRef.current?.focus()
    }
  }, [isFocused, error])

  // Without this, a press outside this field does double duty: it closes
  // this field and, if it lands on a different field's clickable span,
  // immediately opens that field too. Mirrored into a ref (rather than read
  // directly in the effect below) because the listener itself is attached
  // once, for this field's whole mounted lifetime, not re-attached each time
  // isFocused flips.
  const isFocusedRef = useRef(isFocused)
  useLayoutEffect(() => {
    isFocusedRef.current = isFocused
  }, [isFocused])

  useEffect(() => {
    function handlePointerDownCapture(e: PointerEvent) {
      debugLog(`pointerdown type=${e.pointerType} isFocusedRef=${isFocusedRef.current} target=${(e.target as Element)?.tagName}.${(e.target as Element)?.className}`.slice(0, 200))
      if (!isFocusedRef.current) return
      const isOutside = wrapperRef.current !== null && !wrapperRef.current.contains(e.target as Node)
      suppressNextOpen = isOutside
      debugLog(`  -> isOutside=${isOutside} suppressNextOpen=${suppressNextOpen}`)
      // clearAfterClick below already handles a real click correctly no
      // matter how delayed it is, so this fallback only exists for a press
      // that produces no click at all - e.g. Select's own outside-press handling.
      if (isOutside) setTimeout(() => { debugLog('  timeout fired, clearing'); suppressNextOpen = false }, 150)
    }
    // Runs after every more deeply-nested click handler - React's own
    // delegated ones included, since document sits above all of them in the
    // bubble phase - so it only clears the flag once whatever field's
    // onClick was going to read it already has.
    function clearAfterClick() {
      debugLog(`click (document bubble) suppressNextOpen was ${suppressNextOpen}`)
      suppressNextOpen = false
    }
    document.addEventListener('pointerdown', handlePointerDownCapture, true)
    document.addEventListener('click', clearAfterClick)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownCapture, true)
      document.removeEventListener('click', clearAfterClick)
    }
  }, [])

  if (!isFocused) {
    return (
      <As
        ref={wrapperRef}
        tabIndex={0}
        onClick={() => {
          debugLog(`onClick own-field suppressNextOpen=${suppressNextOpen}`)
          if (suppressNextOpen) {
            suppressNextOpen = false
            return
          }
          onFocus()
        }}
        onMouseDown={onMouseDown}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFocus()
          }
        }}
        // inline-block shrinks the hover/click target to the content itself;
        // block instead spans the full width of the container (see the
        // fullWidth prop above). border-transparent (not border-0/no border)
        // + the same px-2.5 py-1 padding Input itself uses: border-*width*
        // and padding never change between this and the actual input it
        // swaps to, so the box is exactly the same height in both states.
        className={cn(
          fullWidth ? 'block' : 'inline-block',
          'cursor-pointer rounded-lg border border-transparent px-2.5 py-1 hover:bg-muted/50',
          className,
        )}
      >
        {renderDisplay(draft)}
      </As>
    )
  }

  // Same block/inline-block choice as the read-mode branch above, and for
  // the same reason - a content-sized (fullWidth false) field needs to stay
  // inline-level in edit mode too, or entering/leaving edit mode would flip
  // it between sharing a line with whatever's next to it and forcing a
  // block-level line break, reflowing any sibling that was sharing that line.
  return (
    <div ref={wrapperRef as RefObject<HTMLDivElement | null>} className={cn(fullWidth ? 'block' : 'inline-block', editModeClassName)}>
      {renderInput({ draft, onChange, onBlur, onKeyDown, hasError: error !== null, errorId, ref: inputRef })}
      {error !== null && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
