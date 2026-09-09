import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Dance } from '@/lib/powersync/schema'
import { DancesPage } from './DancesPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// The mocked useQuery stands in for DancesPage.data.ts's raw SQL result, so
// choreographers/key_moves/vibes here are the pre-parse JSON array *strings*
// (matching json_group_array's real output), not real arrays - all default
// to an empty array so tests that don't care about them still see '-'.
function makeDance(
  overrides: Partial<Dance> & { choreographers?: string; key_moves?: string; vibes?: string } = {},
): Dance & { choreographers: string; key_moves: string; vibes: string } {
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
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    render(<DancesPage />)

    const query = useQueryMock.mock.calls[0][0] as string

    expect(query).toContain('FROM dances')
    for (const column of ['title', 'difficulty', 'formation', 'notes', 'created_at', 'updated_at']) {
      expect(query).toContain(`dances.${column}`)
    }

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

  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    render(<DancesPage />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders a dance row with all columns correctly formatted', () => {
    useQueryMock.mockReturnValue({ data: [makeDance()], isLoading: false })
    render(<DancesPage />)

    const table = screen.getByRole('table')
    const row = within(table).getByText('Chorus Jig').closest('tr')!
    expect(row).toHaveTextContent('Chorus Jig')
    expect(row).toHaveTextContent('Becket')
    expect(row).toHaveTextContent('1/15/26')
    expect(row).toHaveTextContent('3/20/26')

    const notesCell = within(row).getByText('A classic.')
    expect(notesCell).toHaveAttribute('title', 'A classic.')
  })

  it('shows placeholders for null/empty title, difficulty, formation, and notes', () => {
    useQueryMock.mockReturnValue({
      data: [makeDance({ title: '', difficulty: null, formation: null, notes: null })],
      isLoading: false,
    })
    render(<DancesPage />)

    const table = screen.getByRole('table')
    // created_at isn't overridden, so it's the one non-empty field left to
    // find this row by - title itself now renders '—' the same as the rest,
    // so it can't be used to locate the row anymore.
    const row = within(table).getByRole('row', { name: /1\/15\/26/ })
    // title, difficulty, formation, and notes are all null/empty, plus the
    // default empty choreographers/key_moves/vibes lists from makeDance() -
    // seven '—' cells
    expect(within(row).getAllByText('—')).toHaveLength(7)
  })

  it('joins multiple choreographer names with ", ", and shows a placeholder when there are none', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDance({ id: '1', title: 'Dance A', choreographers: '["Alice","Bob"]' }),
        makeDance({ id: '2', title: 'Dance B', choreographers: '[]' }),
      ],
      isLoading: false,
    })
    render(<DancesPage />)

    const table = screen.getByRole('table')
    const rowA = within(table).getByText('Dance A').closest('tr')!
    expect(rowA).toHaveTextContent('Alice, Bob')

    const rowB = within(table).getByText('Dance B').closest('tr')!
    // Three '—' cells: empty choreographers, plus the default empty
    // key_moves/vibes lists from makeDance() that this test doesn't override.
    expect(within(rowB).getAllByText('—')).toHaveLength(3)
  })

  it('joins multiple key_move and vibe names with ", ", and shows a placeholder when there are none', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDance({ id: '1', title: 'Dance A', key_moves: '["Allemande","Swing"]', vibes: '["Playful"]' }),
        makeDance({ id: '2', title: 'Dance B', key_moves: '[]', vibes: '[]' }),
      ],
      isLoading: false,
    })
    render(<DancesPage />)

    const table = screen.getByRole('table')
    const rowA = within(table).getByText('Dance A').closest('tr')!
    expect(rowA).toHaveTextContent('Allemande, Swing')
    expect(rowA).toHaveTextContent('Playful')

    const rowB = within(table).getByText('Dance B').closest('tr')!
    // Three '—' cells: empty key_moves and vibes, plus the default empty
    // choreographers list from makeDance() that this test doesn't override.
    expect(within(rowB).getAllByText('—')).toHaveLength(3)
  })

  it('also renders the same dance in the card list layout', () => {
    useQueryMock.mockReturnValue({ data: [makeDance()], isLoading: false })
    render(<DancesPage />)

    // Both layouts render simultaneously in jsdom (no real CSS breakpoints
    // apply) - two matches confirms the card list's own rendering path also
    // shows the data, not just the table's. Not re-checking every
    // null-handling case again here - same data, same logic, already
    // covered above.
    expect(screen.getAllByText('Becket')).toHaveLength(2)
  })

  it('shortens a "Duple Minor - X" formation to just X, but leaves a bare "Duple Minor" unchanged', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDance({ id: '1', title: 'Dance A', formation: 'Duple Minor - Proper' }),
        makeDance({ id: '2', title: 'Dance B', formation: 'Duple Minor' }),
      ],
      isLoading: false,
    })
    render(<DancesPage />)

    const table = screen.getByRole('table')
    expect(within(table).getByText('Proper')).toBeInTheDocument()
    expect(within(table).queryByText('Duple Minor - Proper')).not.toBeInTheDocument()
    expect(within(table).getByText('Duple Minor')).toBeInTheDocument()
  })

  describe('column visibility', () => {
    it('lists every column except the non-hideable Title as a checked toggle in the Columns menu', async () => {
      useQueryMock.mockReturnValue({ data: [makeDance()], isLoading: false })
      render(<DancesPage />)

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))

      for (const label of [
        'Difficulty',
        'Formation',
        'Choreographers',
        'Key Moves',
        'Vibes',
        'Notes',
        'Created',
        'Updated',
      ]) {
        expect(await screen.findByRole('menuitemcheckbox', { name: label })).toHaveAttribute('aria-checked', 'true')
      }
      // Title always stays visible - hiding it would leave a row with no
      // identifying field, so it's excluded from the menu entirely rather
      // than offered as a toggle that would misbehave if used.
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Title' })).not.toBeInTheDocument()
    })

    it('hides a column from the table when its checkbox is unchecked, and restores it when re-checked', async () => {
      useQueryMock.mockReturnValue({ data: [makeDance()], isLoading: false })
      render(<DancesPage />)

      const table = screen.getByRole('table')
      expect(within(table).getByRole('columnheader', { name: 'Notes' })).toBeInTheDocument()
      expect(within(table).getByText('A classic.')).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Notes' }))

      expect(within(table).queryByRole('columnheader', { name: 'Notes' })).not.toBeInTheDocument()
      expect(within(table).queryByText('A classic.')).not.toBeInTheDocument()

      // The menu stays open after a toggle (closeOnClick defaults to false),
      // so the same checkbox item can be clicked again to restore it.
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Notes' }))

      expect(within(table).getByRole('columnheader', { name: 'Notes' })).toBeInTheDocument()
      expect(within(table).getByText('A classic.')).toBeInTheDocument()
    })
  })

  describe('sorting', () => {
    it('sorts ascending then descending then clears back to the original order on repeated clicks, showing a matching arrow each time', async () => {
      useQueryMock.mockReturnValue({
        data: [
          makeDance({ id: '1', title: 'Charlie' }),
          makeDance({ id: '2', title: 'Alpha' }),
          makeDance({ id: '3', title: 'Bravo' }),
        ],
        isLoading: false,
      })
      render(<DancesPage />)

      const table = screen.getByRole('table')
      const titleHeader = screen.getByRole('button', { name: 'Title' })
      expect(rowTitlesInOrder(table)).toEqual(['Charlie', 'Alpha', 'Bravo'])
      expect(titleHeader.querySelector('svg')).not.toBeInTheDocument()

      const user = userEvent.setup()

      await user.click(titleHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Alpha', 'Bravo', 'Charlie'])
      expect(titleHeader.querySelector('.lucide-arrow-up')).toBeInTheDocument()

      await user.click(titleHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Charlie', 'Bravo', 'Alpha'])
      expect(titleHeader.querySelector('.lucide-arrow-down')).toBeInTheDocument()

      await user.click(titleHeader)
      expect(rowTitlesInOrder(table)).toEqual(['Charlie', 'Alpha', 'Bravo'])
      expect(titleHeader.querySelector('svg')).not.toBeInTheDocument()
    })

    it('sorts a row with a missing value to the end, regardless of ascending or descending', async () => {
      useQueryMock.mockReturnValue({
        data: [
          makeDance({ id: '1', title: 'Has difficulty 3', difficulty: 3 }),
          makeDance({ id: '2', title: 'Has no difficulty', difficulty: null }),
          makeDance({ id: '3', title: 'Has difficulty 1', difficulty: 1 }),
        ],
        isLoading: false,
      })
      render(<DancesPage />)

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
      useQueryMock.mockReturnValue({
        data: [
          makeDance({ id: '1', title: 'Has a note', notes: 'A classic.' }),
          makeDance({ id: '2', title: 'Empty string note', notes: '' }),
          makeDance({ id: '3', title: 'Null note', notes: null }),
        ],
        isLoading: false,
      })
      render(<DancesPage />)

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
      useQueryMock.mockReturnValue({
        data: [
          makeDance({ id: '1', title: 'Shows Banana', formation: 'Banana' }),
          makeDance({ id: '2', title: 'Shows Apple', formation: 'Duple Minor - Apple' }),
        ],
        isLoading: false,
      })
      render(<DancesPage />)

      const table = screen.getByRole('table')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Formation' }))

      expect(rowTitlesInOrder(table)).toEqual(['Shows Apple', 'Shows Banana'])
    })

    it('sorts a tag-list column by its first name alphabetically, matching the alphabetical order it displays in', async () => {
      useQueryMock.mockReturnValue({
        data: [
          // Displays "Amy, Zeb" (see the column-visibility describe block
          // above for renderTagList's own alphabetizing) - sorts by "Amy".
          makeDance({ id: '1', title: 'Amy and Zeb', choreographers: '["Zeb","Amy"]' }),
          makeDance({ id: '2', title: 'Just Ben', choreographers: '["Ben"]' }),
        ],
        isLoading: false,
      })
      render(<DancesPage />)

      const table = screen.getByRole('table')
      expect(within(table).getByText('Amy, Zeb')).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Choreographers' }))

      expect(rowTitlesInOrder(table)).toEqual(['Amy and Zeb', 'Just Ben'])
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

    it('reorders both the card list and the table when a field is picked, and updates the trigger label to match', async () => {
      useQueryMock.mockReturnValue({
        data: [
          makeDance({ id: '1', title: 'Charlie' }),
          makeDance({ id: '2', title: 'Alpha' }),
          makeDance({ id: '3', title: 'Bravo' }),
        ],
        isLoading: false,
      })
      render(<DancesPage />)

      expect(cardTitlesInOrder()).toEqual(['Charlie', 'Alpha', 'Bravo'])

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Sort' }))
      await user.click(await screen.findByRole('menuitemradio', { name: 'Title' }))

      // Same table instance drives both renderings - picking a field here
      // reorders the (still-mounted-in-jsdom) desktop table too, not just
      // the cards.
      const table = screen.getByRole('table')
      expect(cardTitlesInOrder()).toEqual(['Alpha', 'Bravo', 'Charlie'])
      expect(rowTitlesInOrder(table)).toEqual(['Alpha', 'Bravo', 'Charlie'])
      expect(screen.getByRole('button', { name: 'Sort: Title' })).toBeInTheDocument()
    })

    it('flips direction with the toggle button, which stays disabled until a field is chosen', async () => {
      useQueryMock.mockReturnValue({
        data: [makeDance({ id: '1', title: 'Charlie' }), makeDance({ id: '2', title: 'Alpha' })],
        isLoading: false,
      })
      render(<DancesPage />)

      const toggleButton = screen.getByRole('button', { name: 'Sort ascending' })
      expect(toggleButton).toBeDisabled()

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Sort' }))
      await user.click(await screen.findByRole('menuitemradio', { name: 'Title' }))

      // Selecting a field always starts ascending, regardless of whatever
      // direction it was left at last time it was sorted.
      expect(cardTitlesInOrder()).toEqual(['Alpha', 'Charlie'])
      expect(toggleButton).toBeEnabled()

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
      useQueryMock.mockReturnValue({ data: [makeDance()], isLoading: false })
      render(<DancesPage />)

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
      useQueryMock.mockReturnValue({ data: [makeDance()], isLoading: false })
      render(<DancesPage />)

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
  })
})
