import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import { DanceCuesPage } from './DanceCuesPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

function renderDanceCuesPage(versionId = 'v1') {
  const router = createMemoryRouter(
    [
      { path: '/dances/:id/versions/:versionId/cues', element: <DanceCuesPage /> },
      { path: '/dances/:id/versions/:versionId', element: <p>Dance detail page</p> },
      { path: '/dances/:id', element: <p>Dance detail page</p> },
    ],
    { initialEntries: [`/dances/42/versions/${versionId}/cues`] },
  )
  return render(<RouterProvider router={router} />)
}

// order: 0 (the primary version) by default - see DanceWalkthroughPage.test.tsx's
// equivalent, which this mirrors closely (same header logic, different payload).
function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    order: 0,
    label: 'Choreography',
    cues: JSON.stringify({ cells: { 'A1:0:0': '<p>Circle left</p>' }, notes: 'Call it slow the first time' }),
    dance_id: '42',
    dance_title: 'Chorus Jig',
    dance_type: 'Contra',
    formation: 'Duple Minor - Becket',
    progression: 'Single',
    choreographers: '[]',
    version_count: 1,
    ...overrides,
  }
}

describe('DanceCuesPage', () => {
  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    renderDanceCuesPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message when no version matches the id', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    renderDanceCuesPage('missing')

    expect(screen.getByText('Dance version not found.')).toBeInTheDocument()
  })

  it('shows the dance title, figures label, notes, and grid content, plus a link back to the dance', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow()], isLoading: false })
    renderDanceCuesPage()

    expect(screen.getByRole('heading', { name: /^Chorus Jig/ })).toBeInTheDocument()
    expect(screen.getByText('Becket')).toBeInTheDocument()
    expect(screen.getByText('Call it slow the first time')).toBeInTheDocument()
    expect(screen.getByText('Circle left')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Back to dance' }))

    expect(await screen.findByText('Dance detail page')).toBeInTheDocument()
  })

  it('links back to the short /dances/:id form for the primary version', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ order: 0 })], isLoading: false })
    renderDanceCuesPage()

    expect(screen.getByRole('link', { name: 'Back to dance' })).toHaveAttribute('href', '/dances/42')
  })

  it('links back to that version\'s own qualified URL when it is not the primary version', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ order: 1 })], isLoading: false })
    renderDanceCuesPage()

    expect(screen.getByRole('link', { name: 'Back to dance' })).toHaveAttribute('href', '/dances/42/versions/v1')
  })

  it('shows the version label when the dance has more than one version', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ version_count: 2 })], isLoading: false })
    renderDanceCuesPage()

    expect(screen.getByText('Version: Choreography')).toBeInTheDocument()
  })

  it('shows the grid section labels even when there are no cues yet', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ cues: null })], isLoading: false })
    renderDanceCuesPage()

    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('commits edited notes through commitCueNotesEdit, by that version\'s own id, leaving cells untouched', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow()], isLoading: false })
    renderDanceCuesPage()

    const user = userEvent.setup()
    await user.click(screen.getByText('Call it slow the first time'))
    const notesEditor = document.querySelectorAll('[contenteditable="true"]')[0]
    await waitFor(() => expect(notesEditor).toBeInTheDocument())
    await user.type(notesEditor, ' - watch the timing')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [
      JSON.stringify({
        cells: { 'A1:0:0': '<p>Circle left</p>' },
        notes: '<p>Call it slow the first time - watch the timing</p>',
      }),
      'v1',
    ])
  })

  it('commits an edited cell through commitCueCellEdit, leaving notes untouched', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow()], isLoading: false })
    renderDanceCuesPage()

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    const cellEditor = await waitFor(() => {
      const editors = document.querySelectorAll('[contenteditable="true"]')
      const cellEl = [...editors].find((el) => el.textContent?.includes('Circle left'))
      if (!cellEl) throw new Error('cell editor not found yet')
      return cellEl
    })
    await user.type(cellEditor, ' fast')
    await user.tab()

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [
      JSON.stringify({
        cells: { 'A1:0:0': '<p>Circle left fast</p>' },
        notes: 'Call it slow the first time',
      }),
      'v1',
    ])
  })

  it('toggles a separator on the focused cell through commitCueSeparatorToggle', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow()], isLoading: false })
    renderDanceCuesPage()

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await screen.findByRole('toolbar')
    await user.click(screen.getByRole('button', { name: 'Add separator' }))

    // Untouched here - the separator toggle writes back the cell/notes
    // values exactly as they already were, not re-serialized through Tiptap.
    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [
      JSON.stringify({
        cells: { 'A1:0:0': '<p>Circle left</p>' },
        separators: ['A1:0:0'],
        notes: 'Call it slow the first time',
      }),
      'v1',
    ])
  })
})
