import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ResetPasswordPage } from './ResetPasswordPage'

const { updateUserMock, navigateMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(() => Promise.resolve({ error: null as { message: string } | null })),
  navigateMock: vi.fn(),
}))

// This page calls supabase.auth.updateUser directly rather than going
// through AuthContext (updating the current session's password isn't part
// of AuthContext's surface), so it's @/lib/supabase that needs mocking here.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser: updateUserMock } },
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderResetPasswordPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(password: string, confirmPassword: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('New password'), password)
  await user.type(screen.getByLabelText('Confirm new password'), confirmPassword)
  await user.click(screen.getByRole('button', { name: /update password/i }))
}

beforeEach(() => {
  navigateMock.mockClear()
  updateUserMock.mockClear().mockResolvedValue({ error: null })
})

describe('ResetPasswordPage', () => {
  it('calls updateUser with the new password and navigates to /signin on success', async () => {
    renderResetPasswordPage()

    await fillAndSubmit('newpassword123', 'newpassword123')

    expect(updateUserMock).toHaveBeenCalledWith({ password: 'newpassword123' })
    expect(navigateMock).toHaveBeenCalledWith('/signin')
  })

  it('shows an expired-link error and does not navigate when updateUser returns an error', async () => {
    updateUserMock.mockResolvedValueOnce({ error: { message: 'expired' } })
    renderResetPasswordPage()

    await fillAndSubmit('newpassword123', 'newpassword123')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update password. Your reset link may have expired.',
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
