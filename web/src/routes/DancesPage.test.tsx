import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Dance } from '@/lib/powersync/schema'
import { DancesPage } from './DancesPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// The mocked useQuery stands in for DancesPage.data.ts's raw SQL result, so
// choreographers here is the pre-parse JSON array *string* (matching
// json_group_array's real output), not a real array - defaults to an empty
// array so tests that don't care about choreographers still see '-'.
function makeDance(overrides: Partial<Dance> & { choreographers?: string } = {}): Dance & {
  choreographers: string
} {
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
    ...overrides,
  }
}

describe('DancesPage', () => {
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
    // default empty choreographers list from makeDance() - five '—' cells
    expect(within(row).getAllByText('—')).toHaveLength(5)
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
    expect(within(rowB).getByText('—')).toBeInTheDocument()
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
})
