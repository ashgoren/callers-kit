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
    figures: '[]',
    calling_figures: null,
    ...overrides,
  }
}

describe('DanceDetailPage', () => {
  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    renderDanceDetailPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message when no dance matches the id', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    renderDanceDetailPage('missing')

    expect(screen.getByText('Dance not found.')).toBeInTheDocument()
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
    // created_at/updated_at ("Added"/"Edited") are covered by the dedicated test below.
  })

  it('renders Added and Edited as compact "Label: value" lines, not through the standard field list', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    renderDanceDetailPage()

    expect(screen.getByText('Added 1/15/26')).toBeInTheDocument()
    expect(screen.getByText('Edited 3/20/26')).toBeInTheDocument()
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

    // Figures (default '[]' from makeDanceRow), Key Moves, Vibes, Notes,
    // Programs - five placeholders (choreographers moved to the header,
    // which shows nothing at all when empty).
    expect(screen.getAllByText('—')).toHaveLength(5)
  })

  it('renders figures grouped by phrase, with a beats count and interspersed notes', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          figures: JSON.stringify([
            { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' },
            { id: 'f2', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle right</p>' },
            { id: 'n1', kind: 'note', text: '<p>Watch the timing here</p>' },
            { id: 'f3', kind: 'figure', phrase: 'A2', beats: 8, description: '<p>Swing</p>' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    // A1 shows once even though two figures share it (the second doesn't
    // repeat the phrase label) - but each of the three figures still shows
    // its own beats count regardless of whether its phrase label repeats.
    expect(screen.getAllByText('A1')).toHaveLength(1)
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getAllByText('(8)')).toHaveLength(3)
    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(screen.getByText('Circle right')).toBeInTheDocument()
    expect(screen.getByText('Watch the timing here')).toBeInTheDocument()
    expect(screen.getByText('Swing')).toBeInTheDocument()
  })

  it('hides the Choreography/Calling toggle when a dance has no separate calling figures', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow({ calling_figures: null })], isLoading: false })
    renderDanceDetailPage()

    expect(screen.queryByRole('button', { name: 'Calling' })).not.toBeInTheDocument()
  })

  it('toggles between Choreography and Calling, showing only one figures list at a time', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          figures: JSON.stringify([{ id: 'f1', kind: 'figure', phrase: 'A1', beats: null, description: '<p>Circle left</p>' }]),
          calling_figures: JSON.stringify([{ id: 'c1', kind: 'note', text: '<p>Call it slow</p>' }]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    // Choreography is shown by default.
    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(screen.queryByText('Call it slow')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Calling' }))

    expect(screen.queryByText('Circle left')).not.toBeInTheDocument()
    expect(screen.getByText('Call it slow')).toBeInTheDocument()
  })
})
