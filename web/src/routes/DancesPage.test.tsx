import { render, screen, within } from '@testing-library/react'
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
})
