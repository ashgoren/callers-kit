import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DancesPage } from './DancesPage'
import type { DanceQueryRow } from './DancesPage.data'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

// react-router's other exports (MemoryRouter) are used as-is via
// importOriginal - only useNavigate needs mocking, so row-click navigation
// tests can assert on it directly (same pattern as SignInPage.test.tsx).
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderDancesPage() {
  return render(
    <MemoryRouter>
      <DancesPage />
    </MemoryRouter>,
  )
}

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// DancesPage now issues two separate useQuery calls - the dances data query
// (DancesPage.data.ts) and the column-preferences query (useTableColumnState) -
// both routed through the one useQueryMock above. Most tests in this file
// only care about the dances query's result, so the preferences query
// defaults to "a row already exists, with an empty column_state" - matching
// production reality, where every user has one from signup (see
// seed_dances_column_preferences) - with an empty object, not the built-in
// defaults, since that's genuinely what a freshly seeded row holds; a test
// can override what's stored via storedColumnState (see the "persisted
// column state" describe block below).
function mockDances(result: { data: unknown[]; isLoading: boolean }, storedColumnState: object = {}) {
  useQueryMock.mockImplementation((sql: string) =>
    sql.includes('user_table_preferences')
      ? { data: [{ id: 'prefs-1', column_state: JSON.stringify(storedColumnState) }], isLoading: false }
      : result,
  )
}

// Column-preference writes go through db.execute (see tablePreferences.ts) -
// mocked the same way commitFieldEdit.test.ts mocks it, so no test here
// touches the real PowerSync/wa-sqlite machinery.
vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

// jsdom doesn't implement matchMedia at all. TableView's useCoarsePointer hook
// calls window.matchMedia('(pointer: coarse)') to decide whether to render the
// header's right-click context menu (skipped on touch, since it would race
// dnd-kit's own long-press) and whether the sort button gets touch-none. This
// fakes a controllable pointer, defaulting to fine (mouse) - every test here
// exercises the mouse/context-menu behavior unless it opts into coarse via
// mockPointer(true).
function mockPointer(initialIsCoarse: boolean) {
  let matches = initialIsCoarse
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn().mockReturnValue({
    get matches() {
      return matches
    },
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener)
    },
  })
  return {
    setIsCoarse: (value: boolean) => {
      matches = value
      listeners.forEach((listener) => {
        listener()
      })
    },
  }
}

// Re-mocked before every test (not just once at module load) so a test that
// opts into a coarse pointer via mockPointer(true) can't leak that into
// whichever test happens to run next.
beforeEach(() => {
  mockPointer(false)
  navigateMock.mockClear()
})

// Builds the pre-parse JSON *string* tagListSubquery's real output takes -
// json_group_array of {id, name} objects, not a plain array of names.
// Names are turned into throwaway ids (t0, t1, ...) since nothing in these
// tests reads the id itself, only what's displayed.
function tagListJson(names: string[]): string {
  return JSON.stringify(names.map((name, index) => ({ id: `t${index}`, name })))
}

// The mocked useQuery stands in for DancesPage.data.ts's raw SQL result, so
// choreographers/key_moves/vibes here are the pre-parse JSON array *strings*
// (matching json_group_array's real output), not real arrays - all default
// to an empty array so tests that don't care about them still see '-'.
function makeDance(overrides: Partial<DanceQueryRow> = {}): DanceQueryRow {
  return {
    id: '1',
    title: 'Chorus Jig',
    difficulty: 3,
    dance_type: 'Contra',
    formation: 'Duple Minor - Becket',
    progression: 'Single',
    notes: 'A classic.',
    // Noon UTC, not midnight - keeps the formatted calendar date stable
    // across the timezone a test happens to run in.
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    choreographers: '[]',
    key_moves: '[]',
    vibes: '[]',
    programs: '[]',
    ...overrides,
  }
}

// Assumes Title stays the first rendered column - true for this slice since
// column reordering hasn't landed yet. Row 0 is skipped as the header row.
function rowTitlesInOrder(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '')
}

describe('DancesPage', () => {
  it('queries all three tag-style joins with matching junction/owner tables, FK columns, and output aliases', () => {
    // useQuery is fully mocked in every other test here, so nothing else
    // in this file ever inspects the actual SQL DancesPage.data.ts sends -
    // a typo in a table/column name there (e.g. the wrong FK column) would
    // pass every other test in this file and only surface in the slower,
    // live-data e2e suite. This asserts on the real query text instead.
    mockDances({ data: [], isLoading: false })
    renderDancesPage()

    const query = useQueryMock.mock.calls[0][0] as string

    expect(query).toContain('FROM dances')
    for (const column of ['title', 'difficulty', 'dance_type', 'formation', 'progression', 'created_at', 'updated_at']) {
      expect(query).toContain(`dances.${column}`)
    }
    // notes isn't a plain dances.notes column anymore - it's the primary
    // (lowest-order) dance_versions row's own notes, joined in by dance_id.
    expect(query).toContain('FROM dance_versions')
    expect(query).toContain('WHERE dance_versions.dance_id = dances.id')
    expect(query).toContain('AS notes')
    // Baseline order before any client-side sort is applied (and for any
    // future reader of this query that doesn't go through the table's own
    // sorting state, e.g. a print/export view).
    expect(query).toContain('ORDER BY dances.title')

    const joins: [junction: string, owner: string, fk: string, alias: string][] = [
      ['dances_choreographers', 'choreographers', 'choreographer_id', 'choreographers'],
      ['dances_key_moves', 'key_moves', 'key_move_id', 'key_moves'],
      ['dances_vibes', 'vibes', 'vibe_id', 'vibes'],
    ]
    for (const [junction, owner, fk, alias] of joins) {
      expect(query).toContain(`FROM ${junction}`)
      expect(query).toContain(`JOIN ${owner} ON ${owner}.id = ${junction}.${fk}`)
      expect(query).toContain(`WHERE ${junction}.dance_id = dances.id`)
      expect(query).toContain(`AS ${alias}`)
    }
  })

  it('queries a dance\'s program history via programs_dances, most-recent-first, aliased as programs', () => {
    // Its own test, not folded into the tag-style joins loop above - this
    // join goes through an extra hop (programs_dances -> programs) and
    // aggregates {date, location} objects instead of a plain name, so it
    // doesn't fit that loop's shape.
    mockDances({ data: [], isLoading: false })
    renderDancesPage()

    const query = useQueryMock.mock.calls[0][0] as string

    expect(query).toContain('FROM programs_dances')
    expect(query).toContain('JOIN programs ON programs.id = programs_dances.program_id')
    expect(query).toContain('WHERE programs_dances.dance_id = dances.id')
    expect(query).toContain('ORDER BY programs.date DESC')
    expect(query).toContain('AS programs')
    // Selects the program's own id too, not just date/location - used as a
    // stable React key, since date+location alone isn't guaranteed unique.
    expect(query).toContain('programs.id AS id')
  })

  it('shows a loading state while the query is in flight', () => {
    mockDances({ data: [], isLoading: true })
    renderDancesPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('sets the browser tab title to "Dances"', () => {
    mockDances({ data: [], isLoading: false })
    renderDancesPage()

    expect(document.title).toBe("Dances - Caller's Kit")
  })

  it('renders a dance row with all columns correctly formatted', () => {
    mockDances({ data: [makeDance()], isLoading: false })
    renderDancesPage()

    const table = screen.getByRole('table')
    const row = within(table).getByText('Chorus Jig').closest('tr')!
    expect(row).toHaveTextContent('Chorus Jig')
    expect(row).toHaveTextContent('Becket')
    expect(row).toHaveTextContent('Single') // progression
    expect(row).toHaveTextContent('1/15/26')
    expect(row).toHaveTextContent('3/20/26')
    // Dance Type is hidden by default (see DEFAULT_COLUMN_STATE) - its value
    // is covered separately, once toggled on, below.
    expect(within(table).queryByText('Contra')).not.toBeInTheDocument()

    // Notes' full text is behind a hover tooltip now (see
    // DancesPage.columns.tsx) - confirming it renders as a real, focusable
    // trigger, not just plain text.
    expect(within(row).getByRole('button', { name: 'A classic.' })).toBeInTheDocument()
  })

  it('shows notes as a plain-text preview, not the raw HTML tags', () => {
    // notes is stored as HTML (see EditableRichText) - this list view can't
    // sensibly render real markup in a single truncated line, so it should
    // show a stripped preview, not literal "<p>" tags.
    mockDances({ data: [makeDance({ notes: '<p>A classic.</p><ul><li>Watch the swing</li></ul>' })], isLoading: false })
    renderDancesPage()

    const table = screen.getByRole('table')
    expect(within(table).getByText('A classic. Watch the swing')).toBeInTheDocument()
    expect(within(table).queryByText(/<p>|<ul>|<li>/)).not.toBeInTheDocument()
  })

  it('shows placeholders for null/empty title, difficulty, formation, and notes', () => {
    mockDances({
      data: [makeDance({ title: '', difficulty: null, formation: null, notes: null })],
      isLoading: false,
    })
    renderDancesPage()

    const table = screen.getByRole('table')
    // created_at isn't overridden, so it's the one non-empty field left to
    // find this row by - title itself now renders '—' the same as the rest,
    // so it can't be used to locate the row anymore.
    const row = within(table).getByRole('row', { name: /1\/15\/26/ })
    // title, difficulty, formation, and notes are all null/empty, plus the
    // default empty choreographers/key_moves/vibes/programs lists from
    // makeDance() - eight '—' cells
    expect(within(row).getAllByText('—')).toHaveLength(8)
  })

  it('joins multiple choreographer names with ", ", and shows a placeholder when there are none', () => {
    mockDances({
      data: [
        makeDance({ id: '1', title: 'Dance A', choreographers: tagListJson(['Alice', 'Bob']) }),
        makeDance({ id: '2', title: 'Dance B', choreographers: '[]' }),
      ],
      isLoading: false,
    })
    renderDancesPage()

    const table = screen.getByRole('table')
    const rowA = within(table).getByText('Dance A').closest('tr')!
    expect(rowA).toHaveTextContent('Alice, Bob')

    const rowB = within(table).getByText('Dance B').closest('tr')!
    // Four '—' cells: empty choreographers, plus the default empty
    // key_moves/vibes/programs lists from makeDance() that this test doesn't
    // override.
    expect(within(rowB).getAllByText('—')).toHaveLength(4)
  })

  it('joins multiple key_move and vibe names with ", ", and shows a placeholder when there are none', () => {
    mockDances({
      data: [
        makeDance({ id: '1', title: 'Dance A', key_moves: tagListJson(['Allemande', 'Swing']), vibes: tagListJson(['Playful']) }),
        makeDance({ id: '2', title: 'Dance B', key_moves: '[]', vibes: '[]' }),
      ],
      isLoading: false,
    })
    renderDancesPage()

    const table = screen.getByRole('table')
    const rowA = within(table).getByText('Dance A').closest('tr')!
    expect(rowA).toHaveTextContent('Allemande, Swing')
    expect(rowA).toHaveTextContent('Playful')

    const rowB = within(table).getByText('Dance B').closest('tr')!
    // Four '—' cells: empty key_moves and vibes, plus the default empty
    // choreographers/programs lists from makeDance() that this test doesn't
    // override.
    expect(within(rowB).getAllByText('—')).toHaveLength(4)
  })

  it('renders a dance\'s program history in the table as compact dates only, in the recency order the query already provides', () => {
    // The full "date @ location" labels are only available via a real hover
    // tooltip now (Tooltip/TooltipContent, see DancesPage.columns.tsx) -
    // Base UI doesn't mount the tooltip's content into the DOM until it's
    // actually opened (Tooltip.Portal's keepMounted defaults to false), so
    // that part isn't reliably assertable here; see
    // e2e/dances-table.spec.ts for a real-hover check, and
    // ProgramsPage.test.tsx's formatProgramLabel tests for the label-text
    // formatting logic itself (including the no-location fallback).
    mockDances({
      data: [
        makeDance({
          title: 'Dance A',
          programs: JSON.stringify([
            { id: 'p1', date: '2026-10-02', location: 'VFW Hall' },
            { id: 'p2', date: '2026-01-01', location: 'Grange Hall' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDancesPage()

    expect(within(screen.getByRole('table')).getByText('10/2/26, 1/1/26')).toBeInTheDocument()
  })

  it('shows the full "date @ location" labels, one per line, in the card list layout - not just the compact dates the table cell shows', () => {
    mockDances({
      data: [
        makeDance({
          title: 'Dance A',
          programs: JSON.stringify([
            { id: 'p1', date: '2026-10-02', location: 'VFW Hall' },
            { id: 'p2', date: '2026-01-01', location: 'Grange Hall' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDancesPage()

    // CardList's outer <ul> is the first "list" role in document order - the
    // program history's own <ul> (see cardRenderProgramList) is nested
    // inside it, further down the tree, so it comes after.
    const [cardList] = screen.getAllByRole('list')
    expect(within(cardList).getByText('10/2/26 @ VFW Hall')).toBeInTheDocument()
    expect(within(cardList).getByText('1/1/26 @ Grange Hall')).toBeInTheDocument()
  })

  it('also renders the same dance in the card list layout', () => {
    mockDances({ data: [makeDance()], isLoading: false })
    renderDancesPage()

    // Both layouts render simultaneously in jsdom (no real CSS breakpoints
    // apply) - two matches confirms the card list's own rendering path also
    // shows the data, not just the table's. Not re-checking every
    // null-handling case again here - same data, same logic, already
    // covered above.
    expect(screen.getAllByText('Becket')).toHaveLength(2)
  })

  it('renders Notes as a hover-tooltip trigger in the table, but as plain untruncated text in the card list - there\'s no hover to reveal a tooltip on touch', () => {
    mockDances({ data: [makeDance({ notes: 'A classic.' })], isLoading: false })
    renderDancesPage()

    expect(within(screen.getByRole('table')).getByRole('button', { name: 'A classic.' })).toBeInTheDocument()

    const cardNotes = within(screen.getByRole('list')).getByText('A classic.')
    expect(cardNotes.className).not.toMatch(/\btruncate\b/)
    // Plain text, not a tooltip trigger - nothing to reveal, everything's
    // already visible.
    expect(cardNotes.tagName).toBe('SPAN')
  })

  it('shortens a "Duple Minor - X" formation to just X, but leaves a bare "Duple Minor" unchanged', () => {
    mockDances({
      data: [
        makeDance({ id: '1', title: 'Dance A', formation: 'Duple Minor - Proper' }),
        makeDance({ id: '2', title: 'Dance B', formation: 'Duple Minor' }),
      ],
      isLoading: false,
    })
    renderDancesPage()

    const table = screen.getByRole('table')
    expect(within(table).getByText('Proper')).toBeInTheDocument()
    expect(within(table).queryByText('Duple Minor - Proper')).not.toBeInTheDocument()
    expect(within(table).getByText('Duple Minor')).toBeInTheDocument()
  })

  describe('column visibility', () => {
    it('lists every column, Title included, as a checked toggle in the Columns menu - except Dance Type, hidden by default', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      for (const label of [
        'Title',
        'Difficulty',
        'Formation',
        'Progression',
        'Choreographers',
        'Key Moves',
        'Vibes',
        'Notes',
        'Programs',
        'Added',
        'Edited',
      ]) {
        expect(await screen.findByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'true')
      }
      expect(await screen.findByRole('switch', { name: 'Dance Type' })).toHaveAttribute('aria-checked', 'false')
    })

    it('hides a column from the table when its toggle is switched off, and restores it when switched back on', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const table = screen.getByRole('table')
      expect(within(table).getByRole('columnheader', { name: 'Notes' })).toBeInTheDocument()
      expect(within(table).getByText('A classic.')).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('switch', { name: 'Notes' }))

      expect(within(table).queryByRole('columnheader', { name: 'Notes' })).not.toBeInTheDocument()
      expect(within(table).queryByText('A classic.')).not.toBeInTheDocument()

      await user.click(await screen.findByRole('switch', { name: 'Notes' }))

      expect(within(table).getByRole('columnheader', { name: 'Notes' })).toBeInTheDocument()
      expect(within(table).getByText('A classic.')).toBeInTheDocument()
    })

    it('shows the Dance Type column and its value once toggled on', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const table = screen.getByRole('table')
      expect(within(table).queryByRole('columnheader', { name: 'Dance Type' })).not.toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('switch', { name: 'Dance Type' }))

      expect(within(table).getByRole('columnheader', { name: 'Dance Type' })).toBeInTheDocument()
      expect(within(table).getByText('Contra')).toBeInTheDocument()
    })

    it('disables the last remaining visible column\'s toggle, so the table can never end up with no columns shown', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      // Hide every column except Title, one at a time.
      // Dance Type is already hidden by default, so it's deliberately left
      // out here - clicking it would show it, not hide it.
      for (const label of ['Difficulty', 'Formation', 'Progression', 'Choreographers', 'Key Moves', 'Vibes', 'Notes', 'Programs', 'Added', 'Edited']) {
        await user.click(await screen.findByRole('switch', { name: label }))
      }

      const titleToggle = screen.getByRole('switch', { name: 'Title' })
      expect(titleToggle).toHaveAttribute('aria-checked', 'true')
      expect(titleToggle).toHaveAttribute('aria-disabled', 'true')

      // Disabled, so clicking it does nothing - Title stays visible.
      await user.click(titleToggle)
      expect(titleToggle).toHaveAttribute('aria-checked', 'true')
      expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'Title' })).toBeInTheDocument()
    })
  })

  describe('sorting', () => {
    it('defaults to sorting by title ascending, then toggles between ascending and descending on repeated clicks (no unsorted state, since multi-sort is disabled)', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Charlie' }),
          makeDance({ id: '2', title: 'Alpha' }),
          makeDance({ id: '3', title: 'Bravo' }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const titleHeader = screen.getByRole('button', { name: 'Title' })
      expect(rowTitlesInOrder(table)).toEqual(['Alpha', 'Bravo', 'Charlie'])
      expect(titleHeader.querySelector('.lucide-arrow-up')).toBeInTheDocument()

      const user = userEvent.setup()

      await user.click(titleHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Charlie', 'Bravo', 'Alpha'])
      expect(titleHeader.querySelector('.lucide-arrow-down')).toBeInTheDocument()

      await user.click(titleHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Alpha', 'Bravo', 'Charlie'])
      expect(titleHeader.querySelector('.lucide-arrow-up')).toBeInTheDocument()

      await user.click(titleHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Charlie', 'Bravo', 'Alpha'])
      expect(titleHeader.querySelector('.lucide-arrow-down')).toBeInTheDocument()
    })

    it('sorts the Programs column descending on the first click, showing the most-recently-called dance first - the opposite of every other column\'s ascending-first default', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Called Long Ago', programs: JSON.stringify([{ id: 'p1', date: '2025-01-01', location: null }]) }),
          makeDance({ id: '2', title: 'Called Recently', programs: JSON.stringify([{ id: 'p2', date: '2026-06-01', location: null }]) }),
          makeDance({ id: '3', title: 'Never Called', programs: '[]' }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const programsHeader = screen.getByRole('button', { name: 'Programs' })

      const user = userEvent.setup()
      await user.click(programsHeader)

      // Descending first click: most recent date first, missing-history dance
      // still sorts last regardless of direction (see sortUndefined: 'last').
      expect(rowTitlesInOrder(table)).toEqual(['Called Recently', 'Called Long Ago', 'Never Called'])
      expect(programsHeader.querySelector('.lucide-arrow-down')).toBeInTheDocument()
    })

    it('sorts a row with a missing value to the end, regardless of ascending or descending', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Has difficulty 3', difficulty: 3 }),
          makeDance({ id: '2', title: 'Has no difficulty', difficulty: null }),
          makeDance({ id: '3', title: 'Has difficulty 1', difficulty: 1 }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      const difficultyHeader = screen.getByRole('button', { name: 'Difficulty' })

      await user.click(difficultyHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Has difficulty 1', 'Has difficulty 3', 'Has no difficulty'])

      await user.click(difficultyHeader)
      // Descending flips the two real values, but the missing one stays
      // last either way - it never jumps to the top just because the
      // direction flipped.
      expect(rowTitlesInOrder(table)).toEqual(['Has difficulty 3', 'Has difficulty 1', 'Has no difficulty'])
    })

    it('sorts an empty-string Notes value to the end alongside a null one, not to the top', async () => {
      // Both display identically as "—" (render uses the same truthy check),
      // so both should be treated as equally "missing" for sorting too -
      // '' is not nullish, so without notes' own sortValue override it would
      // sort as the lexicographically smallest string instead, landing at
      // the top in ascending order rather than the bottom with null.
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Has a note', notes: 'A classic.' }),
          makeDance({ id: '2', title: 'Empty string note', notes: '' }),
          makeDance({ id: '3', title: 'Null note', notes: null }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Notes' }))

      const [first, ...rest] = rowTitlesInOrder(table)
      expect(first).toBe('Has a note')
      expect(rest.sort()).toEqual(['Empty string note', 'Null note'].sort())
    })

    it('sorts Formation by its displayed value (prefix stripped), not the raw stored string', async () => {
      // Raw-string order would put "Banana" before "Duple Minor - Apple"
      // ('B' < 'D'), but displayed order ("Apple" vs. "Banana") puts Apple
      // first - these two rows only distinguish the fix if it's working.
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Shows Banana', formation: 'Banana' }),
          makeDance({ id: '2', title: 'Shows Apple', formation: 'Duple Minor - Apple' }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Formation' }))

      expect(rowTitlesInOrder(table)).toEqual(['Shows Apple', 'Shows Banana'])
    })

    it('sorts a tag-list column by its first name alphabetically, matching the alphabetical order it displays in', async () => {
      mockDances({
        data: [
          // Displays "Amy, Zeb" (see the column-visibility describe block
          // above for renderTagList's own alphabetizing) - sorts by "Amy".
          makeDance({ id: '1', title: 'Amy and Zeb', choreographers: tagListJson(['Zeb', 'Amy']) }),
          makeDance({ id: '2', title: 'Just Ben', choreographers: tagListJson(['Ben']) }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      expect(within(table).getByText('Amy, Zeb')).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Choreographers' }))

      expect(rowTitlesInOrder(table)).toEqual(['Amy and Zeb', 'Just Ben'])
    })

    it('sorts Key Moves by its first name alphabetically, matching the alphabetical order it displays in', async () => {
      // Same shape of check as the Choreographers test above, but for a
      // different tag-list field - each field wires its own sortValue/sortFn,
      // so this doesn't follow automatically from Choreographers' own test.
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Zeb and Amy', key_moves: tagListJson(['Zeb', 'Amy']) }),
          makeDance({ id: '2', title: 'Just Ben', key_moves: tagListJson(['Ben']) }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Key Moves' }))

      expect(rowTitlesInOrder(table)).toEqual(['Zeb and Amy', 'Just Ben'])
    })

    it('sorts Vibes by its first name alphabetically, matching the alphabetical order it displays in', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Zeb and Amy', vibes: tagListJson(['Zeb', 'Amy']) }),
          makeDance({ id: '2', title: 'Just Ben', vibes: tagListJson(['Ben']) }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Vibes' }))

      expect(rowTitlesInOrder(table)).toEqual(['Zeb and Amy', 'Just Ben'])
    })

    it('sorts Added by raw timestamp, descending first (most recently added first)', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Newer', created_at: '2026-03-20T12:00:00.000Z' }),
          makeDance({ id: '2', title: 'Older', created_at: '2026-01-15T12:00:00.000Z' }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Added' }))
      expect(rowTitlesInOrder(table)).toEqual(['Newer', 'Older'])

      await user.click(screen.getByRole('button', { name: 'Added' }))
      expect(rowTitlesInOrder(table)).toEqual(['Older', 'Newer'])
    })

    it('sorts Edited by raw timestamp, descending first (most recently edited first)', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Newer', updated_at: '2026-03-20T12:00:00.000Z' }),
          makeDance({ id: '2', title: 'Older', updated_at: '2026-01-15T12:00:00.000Z' }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Edited' }))
      expect(rowTitlesInOrder(table)).toEqual(['Newer', 'Older'])

      await user.click(screen.getByRole('button', { name: 'Edited' }))
      expect(rowTitlesInOrder(table)).toEqual(['Older', 'Newer'])
    })
  })

  describe('mobile sort menu', () => {
    // Both layouts render simultaneously in jsdom (no real CSS breakpoints
    // apply, see the "also renders the same dance in the card list layout"
    // test above) - card titles are queried directly by list-item role
    // rather than through the table, which the desktop-focused
    // rowTitlesInOrder helper assumes.
    function cardTitlesInOrder(): string[] {
      return screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent ?? '')
    }

    it('defaults to sorting by title ascending, and reorders both the card list and the table when a different field is picked', async () => {
      mockDances({
        data: [
          makeDance({ id: '1', title: 'Charlie' }),
          makeDance({ id: '2', title: 'Alpha' }),
          makeDance({ id: '3', title: 'Bravo' }),
        ],
        isLoading: false,
      })
      renderDancesPage()

      expect(cardTitlesInOrder()).toEqual(['Alpha', 'Bravo', 'Charlie'])
      expect(screen.getByRole('button', { name: 'Sort: Title' })).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Sort: Title' }))
      await user.click(await screen.findByRole('menuitemradio', { name: 'Difficulty' }))

      // Same table instance drives both renderings - picking a field here
      // reorders the (still-mounted-in-jsdom) desktop table too, not just
      // the cards. All three rows share the default difficulty from
      // makeDance, so this only proves the field switched, not the order -
      // sort-by-other-fields is covered by the 'sorting' describe block above.
      const table = screen.getByRole('table')
      expect(screen.getByRole('button', { name: 'Sort: Difficulty' })).toBeInTheDocument()
      expect(cardTitlesInOrder()).toEqual(rowTitlesInOrder(table))
    })

    it('flips direction with the toggle button, which starts enabled since a field (title) is sorted by default', async () => {
      mockDances({
        data: [makeDance({ id: '1', title: 'Charlie' }), makeDance({ id: '2', title: 'Alpha' })],
        isLoading: false,
      })
      renderDancesPage()

      expect(cardTitlesInOrder()).toEqual(['Alpha', 'Charlie'])
      const toggleButton = screen.getByRole('button', { name: 'Sort ascending' })
      expect(toggleButton).toBeEnabled()

      const user = userEvent.setup()
      await user.click(toggleButton)

      expect(cardTitlesInOrder()).toEqual(['Charlie', 'Alpha'])
      expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument()
    })
  })

  describe('column resizing', () => {
    // This verifies the static wiring: a handle exists per column, and the
    // widths declared in DancesPage.columns.tsx/DancesPage.tsx actually
    // reached the rendered <colgroup>. The actual drag gesture is a
    // separate test below - TanStack's resize math is pure clientX
    // arithmetic (no getBoundingClientRect/real layout involved), so it's
    // genuinely exercisable here, not just this static setup.
    it('renders a resize handle and a matching column width for every visible column', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const table = screen.getByRole('table')
      const columnCount = within(table).getAllByRole('columnheader').length
      expect(table.querySelectorAll('.cursor-col-resize')).toHaveLength(columnCount)

      const widths = Array.from(table.querySelectorAll('col')).map((col) => col.style.width)
      // Title, Choreographers, and Difficulty each set their own explicit size in danceFields.
      expect(widths).toContain('250px')
      expect(widths).toContain('150px')
      expect(widths).toContain('105px')
    })

    it('grows a column by the drag distance when its resize handle is dragged', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const table = screen.getByRole('table')
      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      const handle = difficultyHeader.querySelector('.cursor-col-resize')!

      // The resize handler tracks the raw clientX delta between mousedown
      // and mousemove (see columnResizingFeature.utils.js) - it never reads
      // real layout, so a 100px rightward drag should grow the column by
      // exactly 100px regardless of where these coordinates actually fall
      // on jsdom's fake screen.
      fireEvent.mouseDown(handle, { clientX: 300 })
      fireEvent.mouseMove(document, { clientX: 400 })
      fireEvent.mouseUp(document, { clientX: 400 })

      // Finds Difficulty's actual position among the rendered headers rather
      // than assuming one - the <colgroup> and header row are built from
      // the same visible-columns list in the same render, so their indices
      // always line up regardless of column order.
      const headers = within(table).getAllByRole('columnheader')
      const difficultyIndex = headers.indexOf(difficultyHeader)
      const difficultyColWidth = table.querySelectorAll('col')[difficultyIndex].style.width
      expect(difficultyColWidth).toBe('205px') // 105px starting size + 100px drag
    })

    it('stops shrinking a column at its minSize, even when dragged well past it', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const table = screen.getByRole('table')
      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      const handle = difficultyHeader.querySelector('.cursor-col-resize')!

      // Difficulty starts at 105px with the table's defaultColumn minSize of
      // 25px - dragging 1000px left asks for a deeply negative width, which
      // the resize feature clamps to minSize rather than letting it go any
      // smaller.
      fireEvent.mouseDown(handle, { clientX: 1000 })
      fireEvent.mouseMove(document, { clientX: 0 })
      fireEvent.mouseUp(document, { clientX: 0 })

      const headers = within(table).getAllByRole('columnheader')
      const difficultyIndex = headers.indexOf(difficultyHeader)
      const difficultyColWidth = table.querySelectorAll('col')[difficultyIndex].style.width
      expect(difficultyColWidth).toBe('25px')
    })

    it('stops growing a column at its maxSize, even when dragged well past it', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const table = screen.getByRole('table')
      const notesHeader = screen.getByRole('columnheader', { name: 'Notes' })
      const handle = notesHeader.querySelector('.cursor-col-resize')!

      // Notes starts at 250px with a maxSize of 500px - dragging 1000px
      // right asks for a much wider column than that, which the resize
      // feature clamps to maxSize rather than letting it grow any further.
      fireEvent.mouseDown(handle, { clientX: 0 })
      fireEvent.mouseMove(document, { clientX: 1000 })
      fireEvent.mouseUp(document, { clientX: 1000 })

      const headers = within(table).getAllByRole('columnheader')
      const notesIndex = headers.indexOf(notesHeader)
      const notesColWidth = table.querySelectorAll('col')[notesIndex].style.width
      expect(notesColWidth).toBe('500px')
    })

    it('persists the settled width once the drag ends, not on every intermediate move', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      const handle = difficultyHeader.querySelector('.cursor-col-resize')!

      fireEvent.mouseDown(handle, { clientX: 300 })
      fireEvent.mouseMove(document, { clientX: 400 })

      const { db } = await import('@/lib/powersync/database')
      // Still mid-drag: only the live, uncontrolled table state has moved so
      // far - ColumnSizingSync only commits once the drag actually ends.
      expect(db.execute).not.toHaveBeenCalled()

      fireEvent.mouseUp(document, { clientX: 400 })

      expect(db.execute).toHaveBeenCalledWith('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [
        expect.any(String),
        'prefs-1',
      ])
      const [, params] = vi.mocked(db.execute).mock.calls[0]
      const savedState = JSON.parse((params as [string, string])[0]) as { columnSizing: Record<string, number> }
      // 105px starting size + 100px drag, same math as the plain drag test above.
      expect(savedState.columnSizing).toEqual({ difficulty: 205 })
    })

    it('keeps showing the live dragged width even if the component re-renders for an unrelated reason mid-drag', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      const { rerender } = renderDancesPage()

      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      const handle = difficultyHeader.querySelector('.cursor-col-resize')!

      fireEvent.mouseDown(handle, { clientX: 300 })
      fireEvent.mouseMove(document, { clientX: 400 })

      // Something entirely unrelated to resizing (e.g. the dances query
      // itself ticking) causes DancesPage to re-render mid-drag - this
      // shouldn't snap the live drag back to the last-committed width via
      // ColumnSizingSync's inbound sync.
      rerender(
        <MemoryRouter>
          <DancesPage />
        </MemoryRouter>,
      )

      const table = screen.getByRole('table')
      const headers = within(table).getAllByRole('columnheader')
      const difficultyIndex = headers.indexOf(difficultyHeader)
      expect(table.querySelectorAll('col')[difficultyIndex].style.width).toBe('205px')

      fireEvent.mouseUp(document, { clientX: 400 })
    })
  })

  describe('column pinning', () => {
    it('pins Title by default (shown as "Unpin"), with every other column offered as "Pin"', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      expect(await screen.findByRole('button', { name: 'Unpin Title' })).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: 'Pin Difficulty' })).toBeInTheDocument()
    })

    it('sticky-positions Title by default, and removes that once unpinned', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      expect(screen.getByRole('columnheader', { name: 'Title' }).style.position).toBe('sticky')

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('button', { name: 'Unpin Title' }))

      // Re-queried, not the reference from before the click: pinning/unpinning
      // moves a header between two separate pinned/unpinned SortableContext
      // subtrees (see TableView.tsx, added for header-drag reordering), so
      // React remounts it rather than reconciling in place - the old element
      // reference goes stale the moment it crosses that boundary.
      expect(screen.getByRole('columnheader', { name: 'Title' }).style.position).not.toBe('sticky')
      expect(await screen.findByRole('button', { name: 'Pin Title' })).toBeInTheDocument()
    })

    it('sticky-positions a column once its Pin button is clicked', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      expect(screen.getByRole('columnheader', { name: 'Difficulty' }).style.position).not.toBe('sticky')

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('button', { name: 'Pin Difficulty' }))

      // Re-queried - see the previous test's comment on why.
      expect(screen.getByRole('columnheader', { name: 'Difficulty' }).style.position).toBe('sticky')
    })

    it('pins then unpins the same column via two Pin/Unpin clicks in a row on the same menu row', async () => {
      // Guards SortableColumnRow's own "2nd click bug" fix (see its comment
      // in ColumnsMenu.tsx): clicking Pin/Unpin on the same rendered row
      // twice in a row, without re-querying or reopening the menu in between.
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      await user.click(await screen.findByRole('button', { name: 'Pin Difficulty' }))
      expect(screen.getByRole('columnheader', { name: 'Difficulty' }).style.position).toBe('sticky')

      await user.click(await screen.findByRole('button', { name: 'Unpin Difficulty' }))
      expect(screen.getByRole('columnheader', { name: 'Difficulty' }).style.position).not.toBe('sticky')
    })

    it('offsets a second pinned column past the first one\'s width, rather than stacking them at the same position', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('button', { name: 'Pin Difficulty' }))

      // Re-queried after pinning, not captured beforehand - see above.
      const titleHeader = screen.getByRole('columnheader', { name: 'Title' })
      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })

      // pinnedCellStyle sets insetInlineStart from column.getStart('start'),
      // which sums the widths of every pinned column ahead of this one -
      // Difficulty, pinned second, should start exactly where Title's
      // 250px width ends, not at 0 (which would overlap Title instead).
      expect(titleHeader.style.insetInlineStart).toBe('0px')
      expect(difficultyHeader.style.insetInlineStart).toBe('250px')
    })

    it('puts a divider on the last pinned column, in both the header and the body rows, as a persistent boundary between the frozen and scrollable regions', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const titleCell = within(screen.getByRole('table')).getByText('Chorus Jig').closest('td')!
      // Title is the only (and therefore last) pinned column by default.
      expect(within(screen.getByRole('columnheader', { name: 'Title' })).queryByTestId('pin-boundary-divider')).toBeInTheDocument()
      expect(within(screen.getByRole('columnheader', { name: 'Difficulty' })).queryByTestId('pin-boundary-divider')).not.toBeInTheDocument()
      expect(within(titleCell).queryByTestId('pin-boundary-divider')).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('button', { name: 'Pin Difficulty' }))

      // The divider follows whichever pinned column is now last - Difficulty,
      // pinned second - not Title anymore. Re-queried after pinning - see above.
      expect(within(screen.getByRole('columnheader', { name: 'Title' })).queryByTestId('pin-boundary-divider')).not.toBeInTheDocument()
      expect(within(screen.getByRole('columnheader', { name: 'Difficulty' })).queryByTestId('pin-boundary-divider')).toBeInTheDocument()
    })
  })

  describe('column header context menu', () => {
    it('hides a column via a right-click on its header', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const notesHeader = screen.getByRole('columnheader', { name: 'Notes' })
      fireEvent.contextMenu(within(notesHeader).getByRole('button'))

      const user = userEvent.setup()
      await user.click(await screen.findByRole('menuitem', { name: 'Hide' }))

      expect(screen.queryByRole('columnheader', { name: 'Notes' })).not.toBeInTheDocument()
    })

    it('offers Unpin (not Pin) for an already-pinned column, and unpins it on click', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      // Title is pinned by default.
      const titleHeader = screen.getByRole('columnheader', { name: 'Title' })
      expect(titleHeader.style.position).toBe('sticky')
      fireEvent.contextMenu(within(titleHeader).getByRole('button'))

      expect(screen.queryByRole('menuitem', { name: 'Pin' })).not.toBeInTheDocument()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }))

      // Re-queried, not the reference from before the click - unpinning moves
      // this header out of the pinned SortableContext subtree into the
      // unpinned one (see TableView.tsx), which remounts it rather than
      // updating it in place.
      expect(screen.getByRole('columnheader', { name: 'Title' }).style.position).not.toBe('sticky')
    })

    it('pins a column via a right-click on its header, matching the sticky style the manage-columns menu applies', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      expect(difficultyHeader.style.position).not.toBe('sticky')
      fireEvent.contextMenu(within(difficultyHeader).getByRole('button'))

      expect(screen.queryByRole('menuitem', { name: 'Unpin' })).not.toBeInTheDocument()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('menuitem', { name: 'Pin' }))

      // Re-queried - see the previous test's comment on why.
      expect(screen.getByRole('columnheader', { name: 'Difficulty' }).style.position).toBe('sticky')
    })

    it('disables Hide on the last remaining visible column, matching the manage-columns menu guard', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      // Hide every column except Title via the manage-columns menu first.
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      // Dance Type is already hidden by default, so it's deliberately left
      // out here - clicking it would show it, not hide it.
      for (const label of ['Difficulty', 'Formation', 'Progression', 'Choreographers', 'Key Moves', 'Vibes', 'Notes', 'Programs', 'Added', 'Edited']) {
        await user.click(await screen.findByRole('switch', { name: label }))
      }
      await user.keyboard('{Escape}')

      const titleHeader = screen.getByRole('columnheader', { name: 'Title' })
      fireEvent.contextMenu(within(titleHeader).getByRole('button'))

      // Unlike the manage-columns menu's Switch (whose disabled state is
      // enforced in JS via its own useButton guard, so a synthetic click
      // could be asserted against directly), a disabled ContextMenuItem
      // relies on its own data-disabled:pointer-events-none CSS class plus
      // tabindex="-1" (unreachable by Tab) for real protection - jsdom
      // doesn't compile/apply Tailwind's stylesheet, so there's no real
      // computed pointer-events for a synthetic click to respect here.
      // Asserting the disabled state itself (which is what actually drives
      // that CSS) is the meaningful, jsdom-checkable part of this guard.
      const hideItem = await screen.findByRole('menuitem', { name: 'Hide' })
      expect(hideItem).toHaveAttribute('aria-disabled', 'true')
      expect(hideItem).toHaveAttribute('tabindex', '-1')
    })
  })

  describe('column header drag reorder', () => {
    // The actual drag gesture isn't simulated here, for the same reason the
    // manage-columns menu's own reorder tests don't either: dnd-kit's
    // closestCenter collision detection depends on real getBoundingClientRect
    // values, which jsdom fakes as all-zero. This just verifies the static
    // wiring: every sort button also carries dnd-kit's sortable attributes,
    // proving the drag-to-reorder listeners are actually attached to it (not
    // just click-to-sort) - the reorder decision itself is computeColumnReorder,
    // already covered directly below.
    it('wires every sort button up for drag-based reordering, alongside click-to-sort', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      // Dance Type is hidden by default, so it renders no columnheader at
      // all here - deliberately left out.
      for (const label of ['Title', 'Difficulty', 'Formation', 'Progression', 'Choreographers', 'Key Moves', 'Vibes', 'Notes', 'Programs', 'Added', 'Edited']) {
        const sortButton = within(screen.getByRole('columnheader', { name: label })).getByRole('button')
        expect(sortButton).toHaveAttribute('aria-roledescription', 'sortable')
      }
    })

    it('gives the sort button touch-none on a mouse/fine pointer, so a mouse drag claims the gesture immediately', () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const sortButton = within(screen.getByRole('columnheader', { name: 'Title' })).getByRole('button')
      expect(sortButton.className).toMatch(/\btouch-none\b/)
    })

    it('omits touch-none from the sort button on a coarse/touch pointer, so a quick swipe still scrolls natively', () => {
      mockPointer(true)
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const sortButton = within(screen.getByRole('columnheader', { name: 'Title' })).getByRole('button')
      expect(sortButton.className).not.toMatch(/\btouch-none\b/)
    })
  })

  describe('column header context menu on a coarse/touch pointer', () => {
    // base-ui's ContextMenuTrigger detects its own long-press via raw touch
    // events, with a hardcoded 500ms delay that can't be configured or
    // canceled mid-gesture - on a touch pointer it would race dnd-kit's own
    // long-press-to-drag (see TableView.tsx's useCoarsePointer), so the
    // context menu is skipped there entirely. Hide/pin stay reachable via the
    // Columns menu instead (already covered by the `column visibility` and
    // `column reordering` describe blocks above).
    it('never opens, even on a right-click/contextmenu event', () => {
      mockPointer(true)
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const notesHeader = screen.getByRole('columnheader', { name: 'Notes' })
      fireEvent.contextMenu(within(notesHeader).getByRole('button'))

      expect(screen.queryByRole('menuitem', { name: 'Hide' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Pin' })).not.toBeInTheDocument()
    })

    it('reappears if the pointer type switches back to fine mid-session, e.g. a mouse being attached', () => {
      const pointer = mockPointer(true)
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      act(() => {
        pointer.setIsCoarse(false)
      })

      const notesHeader = screen.getByRole('columnheader', { name: 'Notes' })
      fireEvent.contextMenu(within(notesHeader).getByRole('button'))

      expect(screen.queryByRole('menuitem', { name: 'Hide' })).toBeInTheDocument()
    })
  })

  describe('column reordering', () => {
    // The actual drag gesture isn't simulated here, unlike resize's - dnd-kit's
    // closestCenter collision detection (deciding which column you dragged
    // over) depends on real getBoundingClientRect values, which jsdom fakes
    // as all-zero, so a simulated drag wouldn't land on a meaningful target.
    // Resize's drag test worked because that math is pure clientX arithmetic,
    // with no dependency on real layout at all. This just verifies the
    // static wiring: a drag handle exists for every column in the menu.
    it('renders a drag handle for every column in the manage-columns menu', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      for (const label of ['Title', 'Choreographers', 'Key Moves', 'Vibes', 'Difficulty', 'Dance Type', 'Formation', 'Progression', 'Notes', 'Programs', 'Added', 'Edited']) {
        expect(await screen.findByRole('button', { name: `Reorder ${label}` })).toBeInTheDocument()
      }
    })

    it('separates pinned columns from unpinned ones with a divider, so they read as two distinct reorderable groups', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      // The first separator is the pinned/unpinned divider - a second one
      // now precedes the "Reset to default" item at the bottom of the menu.
      const [separator] = await screen.findAllByRole('separator')
      // Title is pinned by default, so it belongs before the divider;
      // Difficulty isn't pinned, so it belongs after.
      const titleHandle = screen.getByRole('button', { name: 'Reorder Title' })
      const difficultyHandle = screen.getByRole('button', { name: 'Reorder Difficulty' })
      expect(titleHandle.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(difficultyHandle.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    })
  })

  describe('persisted column state', () => {
    it('renders with a previously saved column layout instead of the built-in defaults', () => {
      mockDances(
        { data: [makeDance()], isLoading: false },
        { columnVisibility: { notes: false }, sorting: [{ id: 'difficulty', desc: true }] },
      )
      renderDancesPage()

      // Notes was hidden in the saved layout - shouldn't render at all,
      // unlike every other test in this file where it's visible by default.
      expect(screen.queryByRole('columnheader', { name: 'Notes' })).not.toBeInTheDocument()
      // Sorted by Difficulty descending in the saved layout, not the
      // built-in Title-ascending default.
      const difficultyHeader = screen.getByRole('button', { name: 'Difficulty' })
      expect(difficultyHeader.querySelector('.lucide-arrow-down')).toBeInTheDocument()
    })

    it('persists a column visibility change to the local db, updating the seeded row by id', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('switch', { name: 'Notes' }))

      const { db } = await import('@/lib/powersync/database')
      expect(db.execute).toHaveBeenCalledWith('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [
        expect.any(String),
        'prefs-1',
      ])
      const [, params] = vi.mocked(db.execute).mock.calls[0]
      const savedState = JSON.parse((params as [string, string])[0]) as { columnVisibility: unknown }
      // dance_type: false carries over from DEFAULT_COLUMN_STATE (hidden by
      // default), alongside the Notes toggle this test just made.
      expect(savedState.columnVisibility).toEqual({ dance_type: false, notes: false })
    })

    it('restores a previously saved column width instead of the field\'s built-in default', () => {
      mockDances({ data: [makeDance()], isLoading: false }, { columnSizing: { difficulty: 205 } })
      renderDancesPage()

      const table = screen.getByRole('table')
      const headers = within(table).getAllByRole('columnheader')
      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      const difficultyIndex = headers.indexOf(difficultyHeader)
      expect(table.querySelectorAll('col')[difficultyIndex].style.width).toBe('205px')
    })

    it('picks up a remote column-width change without needing a reload', () => {
      mockDances({ data: [makeDance()], isLoading: false }, {})
      const { rerender } = renderDancesPage()

      const colWidth = () => {
        const table = screen.getByRole('table')
        const headers = within(table).getAllByRole('columnheader')
        const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
        return table.querySelectorAll('col')[headers.indexOf(difficultyHeader)].style.width
      }

      expect(colWidth()).toBe('105px') // Difficulty's built-in default

      // Simulates another device's resize syncing in while this tab stays
      // open - same reactive-query mechanism the other four preference
      // fields already rely on for this (see useTableColumnState.test.tsx).
      mockDances({ data: [makeDance()], isLoading: false }, { columnSizing: { difficulty: 205 } })
      rerender(
        <MemoryRouter>
          <DancesPage />
        </MemoryRouter>,
      )

      expect(colWidth()).toBe('205px')
    })

    it('resets sorting, visibility, pinning, order, and column widths back to the built-in defaults', async () => {
      mockDances(
        { data: [makeDance()], isLoading: false },
        {
          columnVisibility: { notes: false },
          sorting: [{ id: 'difficulty', desc: true }],
          columnSizing: { difficulty: 205 },
        },
      )
      renderDancesPage()

      // Confirms the saved (non-default) layout actually took effect first.
      expect(screen.queryByRole('columnheader', { name: 'Notes' })).not.toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Reset to default' }))

      const { db } = await import('@/lib/powersync/database')
      const [, params] = vi.mocked(db.execute).mock.calls.at(-1)!
      const savedState = JSON.parse((params as [string, string])[0]) as object
      expect(savedState).toEqual({
        columnVisibility: { dance_type: false },
        sorting: [{ id: 'title', desc: false }],
        columnPinning: { start: ['title'], end: [] },
        columnOrder: [],
        columnSizing: {},
      })

      // Notes is visible again.
      expect(screen.getByRole('columnheader', { name: 'Notes' })).toBeInTheDocument()
      // Difficulty's column width reverted from its saved 205px back to its
      // built-in 105px default.
      const table = screen.getByRole('table')
      const headers = within(table).getAllByRole('columnheader')
      const difficultyHeader = screen.getByRole('columnheader', { name: 'Difficulty' })
      expect(table.querySelectorAll('col')[headers.indexOf(difficultyHeader)].style.width).toBe('105px')
    })
  })

  describe('row click navigation', () => {
    it('navigates to the dance\'s detail page when a table row is clicked', async () => {
      mockDances({ data: [makeDance()], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('cell', { name: 'Chorus Jig' }))

      expect(navigateMock).toHaveBeenCalledWith('/dances/1')
    })

    it('still navigates when the click lands on the Notes hover-tooltip trigger - it has no independent click action of its own', async () => {
      mockDances({ data: [makeDance({ notes: 'A classic.' })], isLoading: false })
      renderDancesPage()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'A classic.' }))

      expect(navigateMock).toHaveBeenCalledWith('/dances/1')
    })
  })
})
