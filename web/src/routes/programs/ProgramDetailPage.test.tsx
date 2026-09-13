import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ProgramDetailPage } from './ProgramDetailPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// Needs a real route (not just a bare MemoryRouter) so useParams() resolves
// the :id segment, unlike DancesPage/ProgramsPage's tests, which only need
// useNavigate() to have somewhere to attach to.
function renderProgramDetailPage(id = '1') {
  const router = createMemoryRouter([{ path: '/programs/:id', element: <ProgramDetailPage /> }], {
    initialEntries: [`/programs/${id}`],
  })
  return render(<RouterProvider router={router} />)
}

function makeProgramRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    date: '2026-09-13',
    location: 'Grange Hall',
    notes: 'Bring extra chairs.',
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    dances: '[{"programDanceId":"pd-1","danceId":"d-1","order":1,"title":"Chorus Jig"}]',
    ...overrides,
  }
}

describe('ProgramDetailPage', () => {
  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    renderProgramDetailPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message and a working back link when no program matches the id', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    renderProgramDetailPage('missing')

    expect(screen.getByText('Program not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Programs' })).toHaveAttribute('href', '/programs')
  })

  it('renders date and location stacked in the page header, and every other field with its correct value', () => {
    useQueryMock.mockReturnValue({ data: [makeProgramRow()], isLoading: false })
    renderProgramDetailPage()

    expect(screen.getByRole('heading', { name: '9/13/26' })).toBeInTheDocument()
    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
    expect(screen.getByText('1. Chorus Jig')).toBeInTheDocument()
    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
    // created_at/updated_at are dropped entirely now - never rendered.
    expect(screen.queryByText('1/15/26')).not.toBeInTheDocument()
    expect(screen.queryByText('3/20/26')).not.toBeInTheDocument()
  })

  it('shows "No date" in the header when date is missing, and omits the location line entirely when it is missing', () => {
    useQueryMock.mockReturnValue({ data: [makeProgramRow({ date: null, location: null })], isLoading: false })
    renderProgramDetailPage()

    expect(screen.getByRole('heading', { name: 'No date' })).toBeInTheDocument()
    expect(screen.queryByText('Grange Hall')).not.toBeInTheDocument()
  })

  it('shows placeholders for empty notes and dance lineup', () => {
    useQueryMock.mockReturnValue({
      data: [makeProgramRow({ notes: null, dances: '[]' })],
      isLoading: false,
    })
    renderProgramDetailPage()

    // Dances, Notes - two placeholders (date/location moved to the header,
    // which has its own no-data handling instead of a placeholder).
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
