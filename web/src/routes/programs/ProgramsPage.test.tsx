import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Program } from '@/lib/powersync/schema'
import { formatProgramLabel } from './ProgramsPage.columns'
import { ProgramsPage } from './ProgramsPage'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

// react-router's other exports (MemoryRouter) are used as-is via
// importOriginal - only useNavigate needs mocking, so row-click navigation
// tests can assert on it directly (same pattern as SignInPage.test.tsx).
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderProgramsPage() {
  return render(
    <MemoryRouter>
      <ProgramsPage />
    </MemoryRouter>,
  )
}

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// ProgramsPage issues two separate useQuery calls - the programs data query
// (ProgramsPage.data.ts) and the column-preferences query
// (useTableColumnState) - both routed through the one useQueryMock above.
// Most tests here only care about the programs query's result, so the
// preferences query defaults to "a row already exists, with an empty
// column_state" - matching production reality (every user has one from
// signup, see seed_table_column_preferences) - with an empty object, not the
// built-in defaults, since that's genuinely what a freshly seeded row holds;
// a test can override what's stored via storedColumnState.
function mockPrograms(result: { data: unknown[]; isLoading: boolean }, storedColumnState: object = {}) {
  useQueryMock.mockImplementation((sql: string) =>
    sql.includes('user_table_preferences')
      ? { data: [{ id: 'prefs-1', column_state: JSON.stringify(storedColumnState) }], isLoading: false }
      : result,
  )
}

vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

// jsdom doesn't implement matchMedia at all - see DancesPage.test.tsx for
// why TableView needs this faked.
function mockPointer(isCoarse: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: isCoarse,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

beforeEach(() => {
  mockPointer(false)
  navigateMock.mockClear()
})

// The mocked useQuery stands in for ProgramsPage.data.ts's raw SQL result,
// so `dances` here is the pre-parse JSON array *string* (matching
// json_group_array/json_object's real output), not a real array. `location`
// is likewise the row shape's joined-in locations.name, not a raw Program
// column - see ProgramQueryRow in ProgramsPage.data.ts.
function makeProgram(
  overrides: Partial<Program> & { dances?: string; location?: string | null } = {},
): Program & { dances: string; location: string | null } {
  return {
    id: '1',
    date: '2026-09-13',
    location: 'Grange Hall',
    location_id: null,
    notes: 'Bring extra chairs.',
    // Noon UTC, not midnight - keeps the formatted calendar date stable
    // across the timezone a test happens to run in.
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    share_token: 'token-1',
    dances: '[]',
    ...overrides,
  }
}

describe('formatProgramLabel', () => {
  it('combines a formatted date and location with " @ "', () => {
    expect(formatProgramLabel({ id: 'p1', date: '2026-09-13', location: 'Grange Hall' })).toBe('9/13/26 @ Grange Hall')
  })

  it('falls back to just the formatted date when location is missing', () => {
    expect(formatProgramLabel({ id: 'p1', date: '2026-09-13', location: null })).not.toContain('@')
    expect(formatProgramLabel({ id: 'p1', date: '2026-09-13', location: null })).toBe('9/13/26')
  })
})

describe('ProgramsPage', () => {
  it('queries the ordered dance-lineup join with the expected tables, order column, and output alias', () => {
    mockPrograms({ data: [], isLoading: false })
    renderProgramsPage()

    const query = useQueryMock.mock.calls[0][0] as string

    expect(query).toContain('FROM programs')
    for (const column of ['date', 'location', 'notes', 'created_at', 'updated_at']) {
      expect(query).toContain(`programs.${column}`)
    }
    expect(query).toContain('ORDER BY programs.date DESC')

    expect(query).toContain('FROM programs_dances')
    expect(query).toContain('JOIN dances ON dances.id = programs_dances.dance_id')
    expect(query).toContain('WHERE programs_dances.program_id = programs.id')
    expect(query).toContain('ORDER BY programs_dances."order"')
    expect(query).toContain('AS dances')
    // Carried for the detail view's future reorder/remove, unused by the
    // table itself.
    expect(query).toContain("'danceId', dance_id")
  })

  it('shows a loading state while the query is in flight', () => {
    mockPrograms({ data: [], isLoading: true })
    renderProgramsPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders a program row with date/location/notes formatted, and numbered dance chips in lineup order', () => {
    mockPrograms({
      data: [
        makeProgram({
          dances: JSON.stringify([
            { programDanceId: 'pd-1', order: 1, title: 'Chorus Jig' },
            { programDanceId: 'pd-2', order: 2, title: 'Reel of Four' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderProgramsPage()

    const table = screen.getByRole('table')
    const row = within(table).getByText('9/13/26').closest('tr')!
    expect(row).toHaveTextContent('Grange Hall')
    expect(row).toHaveTextContent('Bring extra chairs.')
    expect(within(row).getByText('1. Chorus Jig')).toBeInTheDocument()
    expect(within(row).getByText('2. Reel of Four')).toBeInTheDocument()

    // created_at/updated_at are hidden by default (see DEFAULT_COLUMN_STATE) -
    // neither formatted date should appear anywhere in the table.
    expect(within(table).queryByText('1/15/26')).not.toBeInTheDocument()
    expect(within(table).queryByText('3/20/26')).not.toBeInTheDocument()
  })

  it('shows notes as a plain-text preview, not the raw HTML tags', () => {
    // notes is stored as HTML (see EditableRichText) - this list view can't
    // sensibly render real markup in a single truncated line, so it should
    // show a stripped preview, not literal "<p>" tags.
    mockPrograms({
      data: [makeProgram({ notes: '<p>Bring extra chairs.</p><ul><li>Snacks</li></ul>' })],
      isLoading: false,
    })
    renderProgramsPage()

    const table = screen.getByRole('table')
    expect(within(table).getByText('Bring extra chairs. Snacks')).toBeInTheDocument()
    expect(within(table).queryByText(/<p>|<ul>|<li>/)).not.toBeInTheDocument()
  })

  it('renders every dance distinctly, without a duplicate React key warning, when legacy data has more than one dance sharing the same order value', () => {
    // Some real programs predate this app (see programDancesSubquery's
    // comment) and have more than one dance stuck at order 0 - the lineup
    // must still key each one uniquely via its own programDanceId, not the
    // shared/duplicated order value.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockPrograms({
      data: [
        makeProgram({
          dances: JSON.stringify([
            { programDanceId: 'pd-1', order: 0, title: 'Chorus Jig' },
            { programDanceId: 'pd-2', order: 0, title: 'Reel of Four' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderProgramsPage()

    const table = screen.getByRole('table')
    expect(within(table).getByText('0. Chorus Jig')).toBeInTheDocument()
    expect(within(table).getByText('0. Reel of Four')).toBeInTheDocument()
    const loggedDuplicateKeyWarning = consoleError.mock.calls.some((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    )
    expect(loggedDuplicateKeyWarning).toBe(false)
    consoleError.mockRestore()
  })

  it('shows placeholders for null/empty location, notes, and an empty dance lineup', () => {
    mockPrograms({ data: [makeProgram({ location: null, notes: null, dances: '[]' })], isLoading: false })
    renderProgramsPage()

    const table = screen.getByRole('table')
    const row = within(table).getByText('9/13/26').closest('tr')!
    // location, notes, and dances are all null/empty - three '—' cells.
    expect(within(row).getAllByText('—')).toHaveLength(3)
  })

  it('also renders the same program, with its full untruncated numbered dance list, in the card list layout', () => {
    mockPrograms({
      data: [
        makeProgram({
          dances: JSON.stringify([
            { programDanceId: 'pd-1', order: 1, title: 'Chorus Jig' },
            { programDanceId: 'pd-2', order: 2, title: 'Reel of Four' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderProgramsPage()

    // CardList's outer <ul> is the first "list" role in document order - the
    // dance lineup's own <ol> (see cardRenderDanceList) is nested inside it,
    // further down the tree, so it comes after. The number and title are
    // separate elements (a muted number column, not inline "1. Title" text).
    const [cardList] = screen.getAllByRole('list')
    expect(within(cardList).getByText('1')).toBeInTheDocument()
    expect(within(cardList).getByText('Chorus Jig')).toBeInTheDocument()
    expect(within(cardList).getByText('2')).toBeInTheDocument()
    expect(within(cardList).getByText('Reel of Four')).toBeInTheDocument()
  })

  it('shows "date @ location" combined as the card\'s title line, not as separate rows', () => {
    mockPrograms({ data: [makeProgram({ date: '2026-09-13', location: 'Grange Hall' })], isLoading: false })
    renderProgramsPage()

    const [cardList] = screen.getAllByRole('list')
    expect(within(cardList).getByText('9/13/26 @ Grange Hall')).toBeInTheDocument()
    // Location no longer appears as its own labeled row below the title.
    expect(within(cardList).queryByText('Location')).not.toBeInTheDocument()
  })

  it('falls back to just the date on the card title line when a program has no location', () => {
    mockPrograms({ data: [makeProgram({ date: '2026-09-13', location: null })], isLoading: false })
    renderProgramsPage()

    const [cardList] = screen.getAllByRole('list')
    expect(within(cardList).getByText('9/13/26')).toBeInTheDocument()
  })

  it('leaves Created/Updated off the card, even though the table (once toggled on) shows them', () => {
    mockPrograms({ data: [makeProgram()], isLoading: false })
    renderProgramsPage()

    const [cardList] = screen.getAllByRole('list')
    expect(within(cardList).queryByText('Created')).not.toBeInTheDocument()
    expect(within(cardList).queryByText('Updated')).not.toBeInTheDocument()
    expect(within(cardList).queryByText('1/15/26')).not.toBeInTheDocument()
    expect(within(cardList).queryByText('3/20/26')).not.toBeInTheDocument()
  })

  describe('column visibility', () => {
    it('starts with Created/Updated hidden, and every other column shown, in the Columns menu', async () => {
      mockPrograms({ data: [makeProgram()], isLoading: false })
      renderProgramsPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      for (const label of ['Date', 'Location', 'Dances', 'Notes']) {
        expect(await screen.findByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'true')
      }
      for (const label of ['Created', 'Updated']) {
        expect(await screen.findByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'false')
      }
    })

    it('shows the Created/Updated columns once toggled on', async () => {
      mockPrograms({ data: [makeProgram()], isLoading: false })
      renderProgramsPage()

      const table = screen.getByRole('table')
      expect(within(table).queryByRole('columnheader', { name: 'Created' })).not.toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('switch', { name: 'Created' }))

      expect(within(table).getByRole('columnheader', { name: 'Created' })).toBeInTheDocument()
      expect(within(table).getByText('1/15/26')).toBeInTheDocument()
    })
  })

  describe('row click navigation', () => {
    it('navigates to the program\'s detail page when a table row is clicked', async () => {
      mockPrograms({ data: [makeProgram()], isLoading: false })
      renderProgramsPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('cell', { name: 'Grange Hall' }))

      expect(navigateMock).toHaveBeenCalledWith('/programs/1')
    })
  })

  describe('sorting', () => {
    // Assumes Date stays the first rendered column - true given
    // DEFAULT_COLUMN_STATE pins it first.
    function rowDatesInOrder(table: HTMLElement): string[] {
      return within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '')
    }

    it('sorts the Date column descending on the first click - most recent first, not oldest first', async () => {
      mockPrograms(
        {
          data: [
            makeProgram({ id: '1', date: '2025-01-01', location: 'Old Hall' }),
            makeProgram({ id: '2', date: '2026-06-01', location: 'New Hall' }),
          ],
          isLoading: false,
        },
        { sorting: [] }, // starts unsorted, so the click below is a genuine first click
      )
      renderProgramsPage()

      const table = screen.getByRole('table')
      const dateHeader = screen.getByRole('button', { name: 'Date' })

      const user = userEvent.setup()
      await user.click(dateHeader)

      expect(rowDatesInOrder(table)).toEqual(['6/1/26', '1/1/25'])
      expect(dateHeader.querySelector('.lucide-arrow-down')).toBeInTheDocument()
    })
  })
})
