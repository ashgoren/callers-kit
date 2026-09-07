import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'

const {
  onAuthStateChangeMock,
  signInWithPasswordMock,
  signUpMock,
  resetPasswordForEmailMock,
  signOutMock,
} = vi.hoisted(() => ({
  // Typed via vi.fn's generic (rather than a named-but-unused parameter in
  // the implementation) purely so TypeScript infers .mock.calls correctly —
  // the mock itself ignores its argument entirely.
  onAuthStateChangeMock: vi.fn<
    (callback: (event: string, session: { user: User } | null) => void) => {
      data: { subscription: { unsubscribe: () => void } }
    }
  >(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signInWithPasswordMock: vi.fn(() =>
    Promise.resolve({ error: null as { message: string } | null }),
  ),
  signUpMock: vi.fn(() => Promise.resolve({ error: null as { message: string } | null })),
  resetPasswordForEmailMock: vi.fn(() =>
    Promise.resolve({ error: null as { message: string } | null }),
  ),
  signOutMock: vi.fn(() => Promise.resolve({ error: null as { message: string } | null })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      signOut: signOutMock,
    },
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

// Simulates the real onAuthStateChange firing with a given session — exactly
// as the Supabase client does once on subscribe and again on every change.
// vi.fn() already records call arguments, so no separate capture is needed:
// the callback AuthContext passed in is just the most recent recorded call.
function fireAuthStateChange(session: { user: User } | null) {
  const callback = onAuthStateChangeMock.mock.calls.at(-1)?.[0]
  act(() => {
    callback?.('SIGNED_IN', session)
  })
}

beforeEach(() => {
  onAuthStateChangeMock.mockClear()
  onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  signInWithPasswordMock.mockClear().mockResolvedValue({ error: null })
  signUpMock.mockClear().mockResolvedValue({ error: null })
  resetPasswordForEmailMock.mockClear().mockResolvedValue({ error: null })
  signOutMock.mockClear().mockResolvedValue({ error: null })
})

describe('AuthProvider / useAuth', () => {
  it('starts with authLoading true and no user, before onAuthStateChange fires', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.authLoading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('reflects the session once onAuthStateChange fires', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    const user = { id: '1', email: 'a@b.com' } as User

    fireAuthStateChange({ user })

    expect(result.current.authLoading).toBe(false)
    expect(result.current.user).toEqual(user)
  })

  it('clears the user when onAuthStateChange fires with no session', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    fireAuthStateChange(null)

    expect(result.current.authLoading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    onAuthStateChangeMock.mockReturnValueOnce({ data: { subscription: { unsubscribe } } })

    const { unmount } = renderHook(() => useAuth(), { wrapper })
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('signIn calls signInWithPassword and throws on error', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signIn('a@b.com', 'pw')
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })

    signInWithPasswordMock.mockResolvedValueOnce({ error: { message: 'bad credentials' } })
    await expect(result.current.signIn('a@b.com', 'wrong')).rejects.toEqual({
      message: 'bad credentials',
    })
  })

  it('signUp calls signUp with emailRedirectTo and throws on error', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signUp('a@b.com', 'pw')
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: { emailRedirectTo: window.location.origin },
    })

    signUpMock.mockResolvedValueOnce({ error: { message: 'already registered' } })
    await expect(result.current.signUp('a@b.com', 'pw')).rejects.toEqual({
      message: 'already registered',
    })
  })

  it('resetPassword calls resetPasswordForEmail with the reset-password redirect and throws on error', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.resetPassword('a@b.com')
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('a@b.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    resetPasswordForEmailMock.mockResolvedValueOnce({ error: { message: 'rate limited' } })
    await expect(result.current.resetPassword('a@b.com')).rejects.toEqual({
      message: 'rate limited',
    })
  })

  it('signOut calls signOut and throws on error', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signOut()
    expect(signOutMock).toHaveBeenCalled()

    signOutMock.mockResolvedValueOnce({ error: { message: 'network error' } })
    await expect(result.current.signOut()).rejects.toEqual({ message: 'network error' })
  })

  it('throws when used outside AuthProvider', () => {
    // Suppress the expected console.error noise React logs for the
    // uncaught render error this test deliberately triggers.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
    consoleError.mockRestore()
  })
})
