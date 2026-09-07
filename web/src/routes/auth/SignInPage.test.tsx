import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { SignInPage } from './SignInPage'

const { useAuthMock, navigateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

// react-router's other exports (Link, Navigate, MemoryRouter) are used as-is
// via importOriginal — only useNavigate needs mocking, since <Navigate> alone
// can't tell us it fired (it just renders nothing where it redirects to).
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderSignInPage() {
  return render(
    <MemoryRouter>
      <SignInPage />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

beforeEach(() => {
  navigateMock.mockClear()
  useAuthMock.mockReturnValue({
    user: null,
    authLoading: false,
    signIn: vi.fn().mockResolvedValue(undefined),
  })
})

describe('SignInPage', () => {
  it('calls signIn with the entered credentials and navigates to / on success', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ user: null, authLoading: false, signIn })
    renderSignInPage()

    await fillAndSubmit('a@b.com', 'password123')

    expect(signIn).toHaveBeenCalledWith('a@b.com', 'password123')
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('shows a validation error and never calls signIn for an invalid email', async () => {
    const signIn = vi.fn()
    useAuthMock.mockReturnValue({ user: null, authLoading: false, signIn })
    renderSignInPage()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'password123')
    // fireEvent.submit dispatches the submit event directly, bypassing the
    // browser's native constraint validation that a real button click would
    // trigger on this type="email" field — that's what we want here, since
    // it's the app's own zod validation (not the browser's) under test.
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(signIn).not.toHaveBeenCalled()
  })

  it('shows an invalid-credentials error and does not navigate when signIn throws', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('bad credentials'))
    useAuthMock.mockReturnValue({ user: null, authLoading: false, signIn })
    renderSignInPage()

    await fillAndSubmit('a@b.com', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('redirects to / immediately when already authenticated', () => {
    useAuthMock.mockReturnValue({ user: { id: '1' }, authLoading: false, signIn: vi.fn() })
    renderSignInPage()

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('does not redirect while auth is still loading, even with a user present', () => {
    useAuthMock.mockReturnValue({ user: { id: '1' }, authLoading: true, signIn: vi.fn() })
    renderSignInPage()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
