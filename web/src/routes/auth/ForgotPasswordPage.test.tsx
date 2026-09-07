import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.click(screen.getByRole('button', { name: /send reset link/i }))
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ resetPassword: vi.fn().mockResolvedValue(undefined) })
})

describe('ForgotPasswordPage', () => {
  it('calls resetPassword with the entered email and shows the check-your-email panel', async () => {
    const resetPassword = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ resetPassword })
    renderForgotPasswordPage()

    await fillAndSubmit('a@b.com')

    expect(resetPassword).toHaveBeenCalledWith('a@b.com')
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
  })

  it('shows a send error and stays on the form when resetPassword throws', async () => {
    const resetPassword = vi.fn().mockRejectedValue(new Error('rate limited'))
    useAuthMock.mockReturnValue({ resetPassword })
    renderForgotPasswordPage()

    await fillAndSubmit('a@b.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not send reset email. Please try again.',
    )
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })
})
