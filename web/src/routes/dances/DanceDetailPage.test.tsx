import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { DanceDetailPage } from './DanceDetailPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// Needs a real route (not just a bare MemoryRouter) so useParams() resolves
// the :id segment, unlike DancesPage/ProgramsPage's tests, which only need
// useNavigate() to have somewhere to attach to.
function renderDanceDetailPage(id = '1') {
  const router = createMemoryRouter([{ path: '/dances/:id', element: <DanceDetailPage /> }], {
    initialEntries: [`/dances/${id}`],
  })
  return render(<RouterProvider router={router} />)
}

function makeDanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    title: 'Chorus Jig',
    difficulty: 3,
    dance_type: 'Contra',
    formation: 'Duple Minor - Becket',
    progression: 'Single',
    notes: 'A classic.',
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    choreographers: '["Alice","Bob"]',
    key_moves: '["Hey"]',
    vibes: '["Playful"]',
    programs: '[{"id":"p1","date":"2026-01-01","location":"Grange Hall"}]',
    ...overrides,
  }
}

describe('DanceDetailPage', () => {
  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    renderDanceDetailPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message and a working back link when no dance matches the id', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    renderDanceDetailPage('missing')

    expect(screen.getByText('Dance not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Dances' })).toHaveAttribute('href', '/dances')
  })

  it('renders the dance title and choreographers in the page header, and every other field with its correct value', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    renderDanceDetailPage()

    expect(screen.getByRole('heading', { name: 'Chorus Jig' })).toBeInTheDocument()
    expect(screen.getByText('by Alice, Bob')).toBeInTheDocument()
    expect(screen.getByText('Hey')).toBeInTheDocument()
    expect(screen.getByText('Playful')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // difficulty
    expect(screen.getByText('Contra')).toBeInTheDocument()
    expect(screen.getByText('Becket')).toBeInTheDocument() // "Duple Minor - " prefix stripped
    expect(screen.getByText('Single')).toBeInTheDocument()
    expect(screen.getByText('A classic.')).toBeInTheDocument()
    expect(screen.getByText('1/1/26 @ Grange Hall')).toBeInTheDocument() // program history
    expect(screen.getByText('1/15/26')).toBeInTheDocument() // created_at
    expect(screen.getByText('3/20/26')).toBeInTheDocument() // updated_at
  })

  it('omits the "by ..." header line entirely when there are no choreographers, rather than showing a placeholder', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow({ choreographers: '[]' })], isLoading: false })
    renderDanceDetailPage()

    expect(screen.queryByText(/^by /)).not.toBeInTheDocument()
  })

  it('shows placeholders for empty tag lists, notes, and program history', () => {
    useQueryMock.mockReturnValue({
      data: [makeDanceRow({ notes: null, choreographers: '[]', key_moves: '[]', vibes: '[]', programs: '[]' })],
      isLoading: false,
    })
    renderDanceDetailPage()

    // Key Moves, Vibes, Notes, Programs - four placeholders (choreographers
    // moved to the header, which shows nothing at all when empty).
    expect(screen.getAllByText('—')).toHaveLength(4)
  })
})
