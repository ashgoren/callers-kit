import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import { ProgramDetailPage } from './ProgramDetailPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// The date header is now editable, which pulls in commitFieldEdit - real
// PowerSync/wa-sqlite code must never load during this test (see
// commitFieldEdit.test.ts).
vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
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
    location_id: null,
    notes: 'Bring extra chairs.',
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    dances: '[{"programDanceId":"pd-1","danceId":"d-1","order":1,"title":"Chorus Jig"}]',
    ...overrides,
  }
}

const GRANGE_HALL = { id: 'loc-1', name: 'Grange Hall' }

// EditableLocationCombobox issues its own separate useQuery call (via
// useLocations) alongside useProgram()'s program-row query, both routed
// through the same mocked useQuery - so, like ProgramsPage.test.tsx's
// mockPrograms(), this has to branch on the SQL text rather than return one
// fixed result for every call.
function mockProgramQuery(result: { data: unknown[]; isLoading: boolean }, locations: { id: string; name: string }[] = []) {
  useQueryMock.mockImplementation((sql: string) => (sql.includes('FROM locations') ? { data: locations, isLoading: false } : result))
}

describe('ProgramDetailPage', () => {
  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    renderProgramDetailPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message when no program matches the id', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    renderProgramDetailPage('missing')

    expect(screen.getByText('Program not found.')).toBeInTheDocument()
  })

  it('renders date and location stacked in the page header, and every other field with its correct value', () => {
    mockProgramQuery({ data: [makeProgramRow({ location_id: GRANGE_HALL.id })], isLoading: false }, [GRANGE_HALL])
    renderProgramDetailPage()

    expect(screen.getByRole('heading', { name: '9/13/26' })).toBeInTheDocument()
    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
    expect(screen.getByText('1. Chorus Jig')).toBeInTheDocument()
    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
    // created_at/updated_at are dropped entirely now - never rendered.
    expect(screen.queryByText('1/15/26')).not.toBeInTheDocument()
    expect(screen.queryByText('3/20/26')).not.toBeInTheDocument()
  })

  it('commits an edited date through commitFieldEdit, by this program\'s own id', async () => {
    mockProgramQuery({ data: [makeProgramRow({ id: '42' })], isLoading: false })
    renderProgramDetailPage('42')

    const user = userEvent.setup()
    await user.click(screen.getByRole('heading', { name: '9/13/26' }))
    const input = screen.getByDisplayValue('2026-09-13')
    // fireEvent.change, not userEvent.type - see EditableDate.test.tsx.
    fireEvent.change(input, { target: { value: '2026-10-20' } })
    await user.tab()

    expect(db.execute).toHaveBeenCalledWith('UPDATE programs SET date = ? WHERE id = ?', ['2026-10-20', '42'])
  })

  it('commits edited notes through commitFieldEdit, by this program\'s own id', async () => {
    // EditableRichText's own test suite covers the Save/Cancel/Discard
    // interaction model and sanitization in detail - this only needs to
    // confirm the wiring in ProgramDetailPage.tsx itself: that
    // saving actually reaches commitFieldEdit with this row's real id and
    // the 'notes' column, the same thing the date test above confirms for
    // the header's date field.
    mockProgramQuery({ data: [makeProgramRow({ id: '42', notes: null })], isLoading: false })
    renderProgramDetailPage('42')

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    const editor = document.querySelector('[contenteditable="true"]')
    await waitFor(() => expect(editor).toBeInTheDocument())
    await user.type(editor!, 'Bring extra chairs.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(db.execute).toHaveBeenCalledWith('UPDATE programs SET notes = ? WHERE id = ?', [
      '<p>Bring extra chairs.</p>',
      '42',
    ])
  })

  it('shows "No date" in the header when date is missing, and a muted placeholder on the location line when it is missing', () => {
    mockProgramQuery({ data: [makeProgramRow({ date: null, location_id: null })], isLoading: false })
    renderProgramDetailPage()

    expect(screen.getByRole('heading', { name: 'No date' })).toBeInTheDocument()
    expect(screen.queryByText('Grange Hall')).not.toBeInTheDocument()
    // The location line is now an always-present editable field (like every
    // other field in this app), not conditionally omitted - it shows the
    // same muted "—" placeholder as any other empty field instead.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows placeholders for empty location, notes, and dance lineup', () => {
    mockProgramQuery({
      data: [makeProgramRow({ notes: null, dances: '[]' })],
      isLoading: false,
    })
    renderProgramDetailPage()

    // Two "—" placeholders now - location (location_id defaults to null in
    // makeProgramRow) and the empty dance lineup. Notes is editable and
    // shows EditableRichText's own descriptive placeholder instead.
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })
})
