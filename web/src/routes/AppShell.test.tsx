import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppShell } from './AppShell'

const { useAuthMock, useThemeMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useThemeMock: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: useThemeMock,
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
  useThemeMock.mockReturnValue({ theme: 'system', setTheme: vi.fn() })
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

  it('shows Light/Dark/System options in a Theme submenu, reflecting the current theme, and calls setTheme on selection', async () => {
    const setTheme = vi.fn()
    useThemeMock.mockReturnValue({ theme: 'dark', setTheme })
    renderAppShell()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'jane@example.com' }))
    // Options are hidden inside a submenu until "Theme" is opened, keeping
    // the top-level menu from being cluttered with all three at once.
    await user.click(await screen.findByRole('menuitem', { name: 'Theme' }))

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument()
    const darkOption = screen.getByRole('menuitemradio', { name: 'Dark' })
    expect(darkOption).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument()

    // fireEvent, not userEvent, here - userEvent's realistic pointer-path
    // simulation trips over the parent menu's positioner, which Base UI
    // marks pointer-events:none while this submenu is open (intentional, so
    // clicks pass through to the submenu correctly) but which sits between
    // wherever the simulated pointer currently is and this target.
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'System' }))

    expect(setTheme).toHaveBeenCalledWith('system')
  })
})
