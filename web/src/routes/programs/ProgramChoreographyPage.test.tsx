import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ProgramChoreographyPage } from './ProgramChoreographyPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

function renderProgramChoreographyPage(id = '1') {
  const router = createMemoryRouter(
    [
      { path: '/programs/:id/choreography', element: <ProgramChoreographyPage /> },
      { path: '/programs/:id', element: <p>Program detail page</p> },
      { path: '/dances/:id', element: <p>Dance detail page</p> },
    ],
    { initialEntries: [`/programs/${id}/choreography`] },
  )
  return render(<RouterProvider router={router} />)
}

function makeProgramRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    date: '2026-09-13',
    location_id: 'loc-1',
    notes: null,
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    dances: '[]',
    location: 'Grange Hall',
    ...overrides,
  }
}

function makeDanceRow(overrides: Record<string, unknown> = {}) {
  return {
    dance_id: 'd1',
    title: 'Chorus Jig',
    order: 1,
    dance_type: 'Contra',
    formation: 'Duple Minor - Becket',
    progression: 'Single',
    figures: JSON.stringify([{ id: 'f1', kind: 'figure', phrase: '', beats: 16, description: 'Circle left' }]),
    manual_phrasing: 0,
    key_moves: '[]',
    ...overrides,
  }
}

// This page runs two separate queries (useProgram's own program-row query,
// plus this page's own dance/figures query) through the same mocked
// useQuery - branch on the SQL text, same as ProgramDetailPage.test.tsx
// does for its own multi-query case.
function mockQueries(programRows: unknown[], danceRows: unknown[] = [], isLoading = false) {
  useQueryMock.mockImplementation((sql: string) =>
    sql.includes('dance_versions') ? { data: danceRows, isLoading } : { data: programRows, isLoading },
  )
}

describe('ProgramChoreographyPage', () => {
  it('shows a loading state while either query is in flight', () => {
    mockQueries([], [], true)
    renderProgramChoreographyPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message when no program matches the id', () => {
    mockQueries([])
    renderProgramChoreographyPage('missing')

    expect(screen.getByText('Program not found.')).toBeInTheDocument()
  })

  it('shows the program date/location, and an empty-lineup message when it has no dances', () => {
    mockQueries([makeProgramRow()], [])
    renderProgramChoreographyPage()

    expect(screen.getByRole('heading', { name: /9\/13\/26/ })).toBeInTheDocument()
    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
    expect(screen.getByText('This program has no dances yet.')).toBeInTheDocument()
  })

  it('sets the browser tab title to the program\'s date/location plus "Choreography"', () => {
    mockQueries([makeProgramRow()], [])
    renderProgramChoreographyPage()

    expect(document.title).toBe("9/13/26 @ Grange Hall Choreography - Caller's Kit")
  })

  it('shows a no-figures message when the lineup has dances but none of them have figures', () => {
    mockQueries([makeProgramRow()], [makeDanceRow({ figures: null })])
    renderProgramChoreographyPage()

    expect(screen.getByText('None of these dances have any figures yet.')).toBeInTheDocument()
  })

  it('lines up each dance\'s figures under a shared phrase row, linking each dance title to its own detail page', async () => {
    mockQueries(
      [makeProgramRow()],
      [
        makeDanceRow({ dance_id: 'd1', order: 1, title: 'Chorus Jig', figures: JSON.stringify([{ id: 'f1', kind: 'figure', phrase: '', beats: 16, description: 'Circle left' }]) }),
        makeDanceRow({ dance_id: 'd2', order: 2, title: 'Rory O\'More', figures: JSON.stringify([{ id: 'f2', kind: 'figure', phrase: '', beats: 16, description: 'Swing neighbor' }]) }),
      ],
    )
    renderProgramChoreographyPage()

    expect(screen.getByRole('link', { name: 'Chorus Jig' })).toHaveAttribute('href', '/dances/d1')
    expect(screen.getByRole('link', { name: "Rory O'More" })).toHaveAttribute('href', '/dances/d2')
    // Lineup position shown above each title, same numbers ProgramDanceLineup itself shows.
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(screen.getByText('Swing neighbor')).toBeInTheDocument()
    // Each figure's beats count - unparenthesized here (unlike FiguresReadOnlyList's
    // own "(N)"), since horizontal space is the priority in this comparison view.
    expect(screen.getAllByText('16')).toHaveLength(2)

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Back to program' }))
    expect(await screen.findByText('Program detail page')).toBeInTheDocument()
  })

  it('shows each dance\'s abbreviated dance_type/formation/progression label and key moves as chips under its title', () => {
    mockQueries(
      [makeProgramRow()],
      [
        makeDanceRow({
          dance_type: 'Square',
          formation: 'Duple Minor - Becket',
          progression: 'Double',
          key_moves: JSON.stringify([{ id: 'k1', name: 'Hey' }, { id: 'k2', name: 'Allemande' }]),
        }),
      ],
    )
    renderProgramChoreographyPage()

    expect(screen.getByText('Square · Becket · Double progression')).toBeInTheDocument()
    // Each key move its own chip, alphabetically sorted - not one joined string.
    expect(screen.getByText('Hey')).toBeInTheDocument()
    expect(screen.getByText('Allemande')).toBeInTheDocument()
  })

  it('defaults the density slider to the midpoint of its range, and widens dance columns when dragged toward Spacious', () => {
    mockQueries([makeProgramRow()], [makeDanceRow()])
    const { container } = renderProgramChoreographyPage()

    const slider = screen.getByRole('slider', { name: 'Column density' })
    // Midpoint of the 100-300 range this page defines - see
    // DEFAULT_COLUMN_MIN_WIDTH in ProgramChoreographyPage.tsx.
    expect(slider).toHaveAttribute('aria-valuenow', '200')

    const grid = container.querySelector('.grid') as HTMLElement
    expect(grid.style.gridTemplateColumns).toContain('minmax(200px, 1fr)')

    fireEvent.change(slider, { target: { value: '300' } })

    expect(grid.style.gridTemplateColumns).toContain('minmax(300px, 1fr)')
  })

  it('shows a muted placeholder for a dance with nothing in a phrase another dance does have', () => {
    mockQueries(
      [makeProgramRow()],
      [
        makeDanceRow({ dance_id: 'd1', figures: JSON.stringify([{ id: 'f1', kind: 'figure', phrase: '', beats: 16, description: 'Circle left' }]) }),
        makeDanceRow({
          dance_id: 'd2',
          figures: JSON.stringify([
            { id: 'f2', kind: 'figure', phrase: '', beats: 16, description: 'Down the hall' },
            { id: 'f3', kind: 'figure', phrase: '', beats: 16, description: 'Swing neighbor' },
          ]),
        }),
      ],
    )
    renderProgramChoreographyPage()

    // d1 has nothing in A2 (its only figure clamps to A1), d2 has one -
    // A2's row still renders, with d1's own cell showing the placeholder.
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText('Swing neighbor')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
