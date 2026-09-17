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
  const router = createMemoryRouter(
    [
      { path: '/dances/:id', element: <DanceDetailPage /> },
      { path: '/dances/:id/versions/:versionId', element: <DanceDetailPage /> },
      { path: '/dances/:id/walkthrough', element: <p>Walkthrough page</p> },
      { path: '/dances/:id/versions/:versionId/walkthrough', element: <p>Walkthrough page</p> },
    ],
    { initialEntries: [`/dances/${id}`] },
  )
  return { ...render(<RouterProvider router={router} />), router }
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

  it('commits edited version notes through commitFieldEdit, by that version\'s own id', async () => {
    // EditableRichText's own test suite covers the Save/Cancel/Discard
    // interaction model and sanitization in detail - this only needs to
    // confirm the two are actually wired together here, against the
    // selected version's own dance_versions row, not the whole dance.
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          id: '42',
          versions: JSON.stringify([{ id: 'v1', label: 'Choreography', figures: [], notes: null }]),
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

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET notes = ? WHERE id = ?', [
      '<p>Watch the timing.</p>',
      'v1',
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

  it('links to the short /dances/:id/walkthrough form when viewing the primary version', async () => {
    // Otherwise that short form would never actually be reachable through
    // this link, since a non-primary version always needs its id spelled out.
    useQueryMock.mockReturnValue({ data: [makeDanceRow({ id: '42' })], isLoading: false })
    renderDanceDetailPage('42')

    expect(screen.getByRole('link', { name: 'Walkthrough' })).toHaveAttribute('href', '/dances/42/walkthrough')

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Walkthrough' }))

    expect(await screen.findByText('Walkthrough page')).toBeInTheDocument()
  })

  it('links to that version\'s own qualified walkthrough URL when it is not the primary version', async () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          id: '42',
          versions: JSON.stringify([
            { id: 'v1', label: 'Choreography', notes: null, figures: [] },
            { id: 'v2', label: 'Calling', notes: null, figures: [] },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage('42')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Calling' }))

    expect(screen.getByRole('link', { name: 'Walkthrough' })).toHaveAttribute(
      'href',
      '/dances/42/versions/v2/walkthrough',
    )
  })

  it('hides the version selector when a dance has only one version', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    renderDanceDetailPage()

    expect(screen.queryByRole('tab', { name: 'Choreography' })).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('tab', { name: 'Calling' }))

    expect(screen.queryByText('Circle left')).not.toBeInTheDocument()
    expect(screen.queryByText('Standard notes.')).not.toBeInTheDocument()
    expect(screen.getByText('Call it slow')).toBeInTheDocument()
    expect(screen.getByText('Calling notes.')).toBeInTheDocument()
  })

  it('resets an open, unedited notes field when switching versions, instead of leaving it open on stale content', async () => {
    // Regression test: EditableRichText's own edit state (isFocused, the
    // mounted Tiptap editor) previously lived on regardless of which
    // version's notes it was passed, since switching versions just re-renders
    // the same element with a new `value` prop rather than remounting it -
    // an already-open editor kept showing the previous version's content,
    // and saving from there would have written it into the wrong version's row.
    // <p>-wrapped, not a bare string - real app-written notes are always
    // already Tiptap HTML. A bare string here would read as dirty the
    // instant the field opens (Tiptap's getHTML() always wraps content in
    // <p>, so it'd never equal an unwrapped draft), which is a fixture
    // realism issue, not the behavior this test means to exercise.
    const { default: userEvent } = await import('@testing-library/user-event')
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          versions: JSON.stringify([
            { id: 'v1', label: 'Choreography', notes: '<p>Standard notes.</p>', figures: [] },
            { id: 'v2', label: 'Calling', notes: '<p>Calling notes.</p>', figures: [] },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    const user = userEvent.setup()
    await user.click(screen.getByText('Standard notes.'))
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: 'Calling' }))

    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
    expect(screen.getByText('Calling notes.')).toBeInTheDocument()
    expect(screen.queryByText('Standard notes.')).not.toBeInTheDocument()
  })

  it('switching versions navigates to that version\'s own URL, rather than only changing local state', async () => {
    // A real navigation (not local state) means AppShell's own useBlocker
    // guard (tested in AppShell.test.tsx) already protects an unsaved note
    // here for free - nothing version-switch-specific to test for that here.
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          id: '42',
          versions: JSON.stringify([
            { id: 'v1', label: 'Choreography', notes: 'Standard notes.', figures: [] },
            { id: 'v2', label: 'Calling', notes: 'Calling notes.', figures: [] },
          ]),
        }),
      ],
      isLoading: false,
    })
    const { router } = renderDanceDetailPage('42')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Calling' }))

    expect(router.state.location.pathname).toBe('/dances/42/versions/v2')
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
