import { useEffect } from 'react'

function isEditableElementFocused(): boolean {
  const active = document.activeElement
  if (active === null) return false
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true
  return active.getAttribute('contenteditable') === 'true'
}

// Runs onEscape when Escape is pressed while nothing on the page is being
// actively edited - lets something reset itself (closing a clean note,
// leaving an edit-mode list) from a stray Escape while just browsing,
// without interfering with whatever a focused field's own Escape handling
// already does for itself.
export function useEscapeWhenUnfocused(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (isEditableElementFocused()) return
      onEscape()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEscape, enabled])
}
