import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ReactNode } from 'react'
import { ProtectedRoute } from './ProtectedRoute'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

// PowerSyncProvider has its own real side effects (connecting to PowerSync)
// and its own dedicated test file - replaced with a passthrough here so this
// file only exercises ProtectedRoute's own loading/redirect/render logic.
vi.mock('@/lib/powersync/PowerSyncProvider', () => ({
  PowerSyncProvider: ({ children }: { children: ReactNode }) => children,
}))

function renderProtectedRoute() {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [{ path: '/', element: <div>Protected content</div> }],
      },
      { path: '/signin', element: <div>Sign in page</div> },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is resolving', () => {
    useAuthMock.mockReturnValue({ user: null, authLoading: true })
    renderProtectedRoute()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('redirects to /signin when not authenticated', () => {
    useAuthMock.mockReturnValue({ user: null, authLoading: false })
    renderProtectedRoute()

    expect(screen.getByText('Sign in page')).toBeInTheDocument()
  })

  it('renders the protected route content when authenticated', () => {
    useAuthMock.mockReturnValue({ user: { id: '1' }, authLoading: false })
    renderProtectedRoute()

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
