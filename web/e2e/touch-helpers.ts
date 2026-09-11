import type { CDPSession, Page } from '@playwright/test'

// Playwright's own page.touchscreen API is deliberately limited to a single
// tap gesture - it can't hold, move, or release, which is exactly what a
// real long-press-then-drag (column reorder, column resize) needs to
// exercise. Playwright's own docs point to dispatching raw touch events via
// Chrome DevTools Protocol for anything beyond a tap, which is what these
// helpers do. Chromium-only (CDP isn't available on WebKit/Firefox), which
// is fine here since this project's only configured browser is chromium.
export async function getTouchClient(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page)
}

async function dispatchTouch(client: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  })
}

// Holds still at the start point for holdMs (clearing useLongPressTouch's/
// dnd-kit TouchSensor's activation delay) before moving to the end point in
// a few steps and releasing - the gesture a genuine long-press-then-drag
// (reorder or resize) needs to activate.
export async function longPressDrag(client: CDPSession, startX: number, startY: number, endX: number, endY: number, holdMs = 700) {
  await dispatchTouch(client, 'touchStart', startX, startY)
  await new Promise((resolve) => setTimeout(resolve, holdMs))

  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    const y = startY + ((endY - startY) * i) / steps
    await dispatchTouch(client, 'touchMove', x, y)
  }

  await dispatchTouch(client, 'touchEnd', endX, endY)
}

// A fast swipe with no hold beforehand - crosses the activation tolerance
// almost immediately, the same way a real "just scrolling/tapping" gesture
// would, rather than a deliberate hold.
export async function quickSwipe(client: CDPSession, startX: number, startY: number, endX: number, endY: number) {
  await dispatchTouch(client, 'touchStart', startX, startY)

  const steps = 5
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    const y = startY + ((endY - startY) * i) / steps
    await dispatchTouch(client, 'touchMove', x, y)
  }

  await dispatchTouch(client, 'touchEnd', endX, endY)
}

// A tap with no movement at all - should read as a plain tap (e.g. sort),
// not activate a long-press gesture.
export async function quickTap(client: CDPSession, x: number, y: number) {
  await dispatchTouch(client, 'touchStart', x, y)
  await dispatchTouch(client, 'touchEnd', x, y)
}
