import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppShell } from './AppShell'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

function renderAppShell() {
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ path: '/', element: <div>Page content</div> }] }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    user: { email: 'jane@example.com' },
    signOut: vi.fn().mockResolvedValue(undefined),
  })
})

describe('AppShell', () => {
  it('renders the page content passed via the route outlet', () => {
    renderAppShell()

    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('shows the signed-in user email in the menu trigger', () => {
    renderAppShell()

    expect(screen.getByRole('button', { name: 'jane@example.com' })).toBeInTheDocument()
  })

  it('calls signOut when Sign out is clicked from the menu', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ user: { email: 'jane@example.com' }, signOut })
    renderAppShell()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'jane@example.com' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(signOut).toHaveBeenCalled()
  })
})
