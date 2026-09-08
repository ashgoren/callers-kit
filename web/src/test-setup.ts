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
})
