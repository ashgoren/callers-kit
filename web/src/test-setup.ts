import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
// Extends Vitest's expect with DOM matchers like toBeInTheDocument()/
// toBeVisible(). The /vitest entry point (not the bare package) is required
// so it hooks into Vitest's expect specifically - we use explicit imports
// (no `globals: true`), so the plain jest-dom import wouldn't find it.
import '@testing-library/jest-dom/vitest'

// RTL doesn't unmount rendered components between tests on its own when
// using explicit imports (its auto-cleanup relies on a global afterEach,
// which we don't have) - without this, one test's rendered output would
// still be in the DOM when the next test runs.
afterEach(() => {
  cleanup()
  resetLatestIntersectionObserverCallback()
})

// jsdom doesn't implement ResizeObserver at all (used by
// TruncatedTooltipText's truncation check) - a no-op stub is enough since
// jsdom never actually resizes anything anyway; the initial synchronous
// scrollWidth/clientWidth check (always 0/0 in jsdom, i.e. "not truncated")
// is what jsdom-based tests can rely on, same as other real-layout-dependent
// behavior in this app that's only provable in a real browser.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom doesn't implement real layout, so a Range has no actual client
// rects to report - Tiptap/ProseMirror (EditableRichText) calls this when
// focusing/scrolling the selection into view, which otherwise throws
// ("target.getClientRects is not a function") the moment such an editor
// mounts in a test. Zeroed stubs are enough since no jsdom-based test can
// assert on real pixel positions anyway.
//
// unbound-method is disabled below because it's flagging lib.dom.d.ts's own
// declaration of these built-ins (none of which specify `this: void`), not
// anything about the plain polyfill functions being assigned in - there's
// no real detached-`this` risk in a top-level prototype assignment.
/* eslint-disable @typescript-eslint/unbound-method */
Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList
Range.prototype.getBoundingClientRect ??= () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} })

// jsdom doesn't implement elementFromPoint either (same "no real layout"
// gap) - ProseMirror's mousedown handling calls this to resolve a click
// into a document position. Returning null is what a genuinely-empty
// point would report anyway, and ProseMirror falls back gracefully.
document.elementFromPoint ??= () => null

// jsdom doesn't implement scrollIntoView either (same "no real layout" gap,
// same reasoning as the Range stubs above) - EditableRichText calls this to
// keep Save/Cancel visible on a tall note. A no-op is enough since no
// jsdom-based test can assert on real scroll position anyway.
Element.prototype.scrollIntoView ??= () => {}
/* eslint-enable @typescript-eslint/unbound-method */

// jsdom doesn't implement IntersectionObserver either (same "no real
// layout" gap) - EditableRichText's resume-editing pill uses this to notice
// when an open note has scrolled out of view. Whether something is actually
// on screen is unknowable without real layout, so unlike the plain no-op
// stubs above, this one records its callback where a test can reach it and
// invoke it directly with a fake entry, to simulate the field scrolling on
// or off screen.
// Reset in afterEach above - otherwise a test that never dirties a field
// (so never creates an observer of its own) would see the previous test's
// leftover callback instead of the null a fresh page actually starts with.
let latestIntersectionObserverCallback: IntersectionObserverCallback | null = null
export function getLatestIntersectionObserverCallback(): IntersectionObserverCallback | null {
  return latestIntersectionObserverCallback
}
function resetLatestIntersectionObserverCallback(): void {
  latestIntersectionObserverCallback = null
}
class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds: number[] = []
  constructor(callback: IntersectionObserverCallback) {
    latestIntersectionObserverCallback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}
globalThis.IntersectionObserver ??= IntersectionObserverStub as unknown as typeof IntersectionObserver
