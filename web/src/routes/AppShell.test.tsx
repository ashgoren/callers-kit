import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppShell } from './AppShell'

const { useAuthMock, useThemeMock, useStatusMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useThemeMock: vi.fn(),
  useStatusMock: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: useThemeMock,
}))

vi.mock('@powersync/react', () => ({
  useStatus: useStatusMock,
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
  // Most tests here aren't specifically about sync status - default to
  // "already synced" so the outlet renders normally, matching every
  // existing test's assumptions. The tests below override this.
  useStatusMock.mockReturnValue({ hasSynced: true })
})

afterEach(() => {
  // Restore real timers unconditionally - only the slow-sync-message test
  // below switches to fake timers, but leaving them faked would silently
  // break userEvent's internal timing in every test that runs after it.
  vi.useRealTimers()
})

describe('AppShell', () => {
  it('renders the page content passed via the route outlet', () => {
    renderAppShell()

    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('shows a plain loading message instead of the route outlet until the initial sync completes', () => {
    useStatusMock.mockReturnValue({ hasSynced: false })
    renderAppShell()

    expect(screen.queryByText('Page content')).not.toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('reveals the detailed slow-sync explanation only once loading has taken a few seconds', () => {
    // A normal refresh of an already-synced device resolves hasSynced
    // almost instantly (a local-only query, no network needed) - the
    // detailed "can take up to a minute" explanation should only appear
    // once loading has genuinely dragged on, never during that brief flash.
    vi.useFakeTimers()
    useStatusMock.mockReturnValue({ hasSynced: false })
    renderAppShell()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText(/this can take up to a minute/)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText(/this can take up to a minute/)).toBeInTheDocument()
  })

  it('keeps the header and sign-out menu usable while the first sync is still loading', async () => {
    useStatusMock.mockReturnValue({ hasSynced: false })
    renderAppShell()

    expect(screen.getByRole('button', { name: 'jane@example.com' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'jane@example.com' }))

    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
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
