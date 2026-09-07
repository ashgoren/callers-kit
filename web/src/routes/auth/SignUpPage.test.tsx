import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { SignUpPage } from './SignUpPage'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

function renderSignUpPage() {
  return render(
    <MemoryRouter>
      <SignUpPage />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(email: string, password: string, confirmPassword: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirmPassword)
  await user.click(screen.getByRole('button', { name: /create account/i }))
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ signUp: vi.fn().mockResolvedValue(undefined) })
})

describe('SignUpPage', () => {
  it('calls signUp with the entered credentials and shows the check-your-email panel', async () => {
    const signUp = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ signUp })
    renderSignUpPage()

    await fillAndSubmit('a@b.com', 'password123', 'password123')

    expect(signUp).toHaveBeenCalledWith('a@b.com', 'password123')
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
  })

  it('shows an account-creation error and stays on the form when signUp throws', async () => {
    const signUp = vi.fn().mockRejectedValue(new Error('already registered'))
    useAuthMock.mockReturnValue({ signUp })
    renderSignUpPage()

    await fillAndSubmit('a@b.com', 'password123', 'password123')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not create account. That email may already be in use.',
    )
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })
})
