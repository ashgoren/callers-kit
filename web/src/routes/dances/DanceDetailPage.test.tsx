import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import { DanceDetailPage } from './DanceDetailPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

// Title is now editable, which pulls in commitFieldEdit - real PowerSync/
// wa-sqlite code must never load during this test (see commitFieldEdit.test.ts).
vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
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

// A single-version dance by default - most tests don't care about the
// version selector at all, so it stays hidden (versions.length > 1 is the
// only thing that shows it).
function makeDanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    title: 'Chorus Jig',
    difficulty: 3,
    dance_type: 'Contra',
    formation: 'Duple Minor - Becket',
    progression: 'Single',
    notes: 'A classic.', // unused by the page now, kept only for row-shape realism
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    choreographers: '["Alice","Bob"]',
    key_moves: '["Hey"]',
    vibes: '["Playful"]',
    programs: '[{"id":"p1","date":"2026-01-01","location":"Grange Hall"}]',
    versions: JSON.stringify([{ id: 'v1', label: 'Choreography', figures: [], notes: 'A classic.' }]),
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

  it('commits an edited title through commitFieldEdit, by this dance\'s own id', async () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow({ id: '42' })], isLoading: false })
    renderDanceDetailPage('42')

    const user = userEvent.setup()
    await user.click(screen.getByRole('heading', { name: 'Chorus Jig' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Money Musk')
    await user.tab()

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET title = ? WHERE id = ?', ['Money Musk', '42'])
  })

  it('commits edited version notes through commitVersionNotes, writing the whole versions array back with only that version\'s notes changed', async () => {
    // EditableRichText's own test suite covers the Save/Cancel/Discard
    // interaction model and sanitization in detail, and commitVersionNotes
    // has its own dedicated tests for the read-modify-write shape - this
    // only needs to confirm the two are actually wired together here, by
    // this dance's own id and versions array.
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          id: '42',
          versions: JSON.stringify([
            { id: 'v1', label: 'Choreography', figures: [], notes: null },
            { id: 'v2', label: 'Calling', figures: [], notes: 'Calling notes.' },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage('42')

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    const editor = document.querySelector('[contenteditable="true"]')
    await waitFor(() => expect(editor).toBeInTheDocument())
    await user.type(editor!, 'Watch the timing.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET versions = ? WHERE id = ?', [
      JSON.stringify([
        { id: 'v1', label: 'Choreography', figures: [], notes: '<p>Watch the timing.</p>' },
        { id: 'v2', label: 'Calling', figures: [], notes: 'Calling notes.' },
      ]),
      '42',
    ])
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
    // "Becket" appears twice - once as the Formation field's own value, once
    // in the figures label above the choreography (see the dedicated tests
    // below for that label's omission rules).
    expect(screen.getAllByText('Becket')).toHaveLength(2)
    expect(screen.getByText('Single')).toBeInTheDocument()
    expect(screen.getByText('A classic.')).toBeInTheDocument() // the primary version's own notes
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

  it('shows placeholders for empty tag lists, figures, notes, and program history', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          choreographers: '[]',
          key_moves: '[]',
          vibes: '[]',
          programs: '[]',
          versions: JSON.stringify([{ id: 'v1', label: 'Choreography', figures: [], notes: null }]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    // Figures, Key Moves, Vibes, Programs - four "—" placeholders
    // (choreographers moved to the header, which shows nothing at all when
    // empty). Notes is now editable and shows EditableRichText's own
    // descriptive placeholder instead of the generic "—".
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('renders figures grouped by phrase, with a beats count and interspersed notes', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          versions: JSON.stringify([
            {
              id: 'v1',
              label: 'Choreography',
              notes: null,
              figures: [
                { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' },
                { id: 'f2', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle right</p>' },
                { id: 'n1', kind: 'note', text: '<p>Watch the timing here</p>' },
                { id: 'f3', kind: 'figure', phrase: 'A2', beats: 8, description: '<p>Swing</p>' },
              ],
            },
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

  it('hides the version selector when a dance has only one version', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    renderDanceDetailPage()

    expect(screen.queryByRole('button', { name: 'Choreography' })).not.toBeInTheDocument()
  })

  it('shows a version selector button per version, and switches which one\'s figures/notes are shown', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          versions: JSON.stringify([
            {
              id: 'v1',
              label: 'Choreography',
              notes: 'Standard notes.',
              figures: [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: null, description: '<p>Circle left</p>' }],
            },
            {
              id: 'v2',
              label: 'Calling',
              notes: 'Calling notes.',
              figures: [{ id: 'c1', kind: 'note', text: '<p>Call it slow</p>' }],
            },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    // The primary (first) version is shown by default.
    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(screen.getByText('Standard notes.')).toBeInTheDocument()
    expect(screen.queryByText('Call it slow')).not.toBeInTheDocument()
    expect(screen.queryByText('Calling notes.')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Calling' }))

    expect(screen.queryByText('Circle left')).not.toBeInTheDocument()
    expect(screen.queryByText('Standard notes.')).not.toBeInTheDocument()
    expect(screen.getByText('Call it slow')).toBeInTheDocument()
    expect(screen.getByText('Calling notes.')).toBeInTheDocument()
  })

  describe('figures label', () => {
    it('renders no label at all when dance_type/formation/progression are all the common case', () => {
      useQueryMock.mockReturnValue({
        data: [makeDanceRow({ dance_type: 'Contra', formation: null, progression: 'Single' })],
        isLoading: false,
      })
      renderDanceDetailPage()

      // "Contra" and "Single" still appear once each, from their own
      // metadata fields - this only confirms the label added nothing on top
      // of that (no " · " separator, no second "Contra"/"Single" instance).
      expect(screen.getAllByText('Contra')).toHaveLength(1)
      expect(screen.getAllByText('Single')).toHaveLength(1)
      expect(screen.queryByText(/·/)).not.toBeInTheDocument()
    })

    it('shows dance_type and progression when they differ from the common case, joined with the formation', () => {
      useQueryMock.mockReturnValue({
        data: [makeDanceRow({ dance_type: 'Square', formation: 'Duple Minor - Improper', progression: 'Double' })],
        isLoading: false,
      })
      renderDanceDetailPage()

      expect(screen.getByText('Square · Improper · Double progression')).toBeInTheDocument()
    })

    it('shows just the formation when only it differs from the common case', () => {
      useQueryMock.mockReturnValue({
        data: [makeDanceRow({ dance_type: 'Contra', formation: 'Duple Minor - Becket', progression: 'Single' })],
        isLoading: false,
      })
      renderDanceDetailPage()

      // Formation's own field value and the label both read "Becket" here -
      // asserting there are exactly two confirms the label rendered at all.
      expect(screen.getAllByText('Becket')).toHaveLength(2)
    })

    it('renders muted, not bold, when the label is just "Improper" - the standard formation', () => {
      useQueryMock.mockReturnValue({
        data: [makeDanceRow({ dance_type: 'Contra', formation: 'Duple Minor - Improper', progression: 'Single' })],
        isLoading: false,
      })
      renderDanceDetailPage()

      // Formation's own field value and the label both read "Improper" - the
      // label is specifically the <p>, not the metadata field's <dd>.
      const label = screen.getAllByText('Improper').find((el) => el.tagName === 'P')!
      expect(label).toHaveClass('text-muted-foreground')
      expect(label).not.toHaveClass('font-semibold')
    })

    it('renders bold, not muted, when the label is anything other than just "Improper"', () => {
      useQueryMock.mockReturnValue({
        data: [makeDanceRow({ dance_type: 'Contra', formation: 'Duple Minor - Becket', progression: 'Single' })],
        isLoading: false,
      })
      renderDanceDetailPage()

      // Formation's own field value and the label both read "Becket" - the
      // label is specifically the <p>, not the metadata field's <dd>.
      const label = screen.getAllByText('Becket').find((el) => el.tagName === 'P')!
      expect(label).toHaveClass('font-semibold')
      expect(label).not.toHaveClass('text-muted-foreground')
    })
  })
})
