import { useEffect, useState } from 'react'

// Matches Tailwind's sm: breakpoint - below this, EditableRichText's edit
// mode is a full-screen mobile takeover; at and above it, edit mode is
// ordinary inline content and this hook's value is never used.
const MOBILE_BREAKPOINT_PX = 640

interface KeyboardSafeViewport {
  // The actual visible height, excluding the on-screen keyboard - undefined
  // until the first real reading, and permanently undefined in a browser
  // without visualViewport support (callers should fall back to a CSS
  // height like dvh in that case).
  height: number | undefined
  isMobile: boolean
}

// vh/dvh/svh (and position: fixed) are computed against the *layout*
// viewport, which most mobile browsers - iOS Safari in particular - don't
// actually shrink for the on-screen keyboard; they just let the keyboard
// overlay on top of it. window.visualViewport reports the *visual*
// viewport instead - what's actually visible on screen right now,
// excluding the keyboard - and fires its own resize event as the keyboard
// opens and closes. This is the standard mechanism apps use to keep a
// full-screen UI element (a chat composer, a fixed toolbar, this editor)
// from being covered by it, since no CSS unit alone can see the keyboard.
export function useKeyboardSafeViewportHeight(): KeyboardSafeViewport {
  const [state, setState] = useState<KeyboardSafeViewport>(() => ({
    height: window.visualViewport?.height,
    isMobile: window.innerWidth < MOBILE_BREAKPOINT_PX,
  }))

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined

    function handleResize() {
      setState({ height: viewport!.height, isMobile: window.innerWidth < MOBILE_BREAKPOINT_PX })
    }

    // Once for whatever's changed between the initial useState call above
    // (which can be stale by the time this effect actually runs) and now.
    handleResize()
    viewport.addEventListener('resize', handleResize)
    return () => viewport.removeEventListener('resize', handleResize)
  }, [])

  return state
}
