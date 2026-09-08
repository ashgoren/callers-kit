import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ThemeProvider, useTheme } from './ThemeContext'

// A controllable fake for window.matchMedia('(prefers-color-scheme: dark)') -
// jsdom doesn't implement matchMedia at all, and this needs to support
// simulating a live OS-level theme change (triggering the registered
// listener), not just returning a fixed value once.
function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<() => void>()
  const mediaQueryList = {
    get matches() {
      return matches
    },
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener)
    },
  }
  window.matchMedia = vi.fn().mockReturnValue(mediaQueryList)
  return {
    setMatches: (value: boolean) => {
      matches = value
      listeners.forEach((listener) => {
        listener()
      })
    },
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ThemeProvider / useTheme', () => {
  it('defaults to system with no stored preference', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('system')
  })

  it('reads a previously stored preference on mount', () => {
    mockMatchMedia(false)
    localStorage.setItem('theme', 'dark')
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('dark')
  })

  it('applies the dark class when theme is dark, regardless of system preference', () => {
    mockMatchMedia(false)
    localStorage.setItem('theme', 'dark')
    renderHook(() => useTheme(), { wrapper })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the dark class when theme is light, regardless of system preference', () => {
    mockMatchMedia(true)
    localStorage.setItem('theme', 'light')
    renderHook(() => useTheme(), { wrapper })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('resolves system to the current OS preference', () => {
    mockMatchMedia(true)
    localStorage.setItem('theme', 'system')
    renderHook(() => useTheme(), { wrapper })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('reacts live to an OS-level theme change while on system', () => {
    const media = mockMatchMedia(false)
    localStorage.setItem('theme', 'system')
    renderHook(() => useTheme(), { wrapper })

    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => {
      media.setMatches(true)
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme persists the choice and updates the applied class', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('throws when used outside ThemeProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider')
    consoleError.mockRestore()
  })
})
