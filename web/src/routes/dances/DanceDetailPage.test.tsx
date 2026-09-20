import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    // choreographers/key_moves/vibes are tagListSubquery's real output shape
    // - {id, name} pairs, not plain names - the ids here are throwaway,
    // nothing in this page reads them yet.
    choreographers: '[{"id":"c1","name":"Alice"},{"id":"c2","name":"Bob"}]',
    key_moves: '[{"id":"k1","name":"Hey"}]',
    vibes: '[{"id":"v1","name":"Playful"}]',
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
    await user.click(screen.getByRole('button', { name: 'Edit notes' }))
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

  it('keeps the sidebar column from growing past its grid share, regardless of any field\'s own content', () => {
    // jsdom has no real layout engine, so this only guards the CSS rule
    // itself (min-w-0 overriding the grid item's default min-width:auto,
    // which is what let a long unbreakable url stretch the column wider
    // than its 1fr share) staying in place, not the actual rendered width.
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    const { container } = renderDanceDetailPage()

    expect(container.querySelector('.min-w-0.space-y-6')).toBeInTheDocument()
  })

  describe('url field', () => {
    it('shows the raw url as-is when it is not an ibiblio Caller\'s Box link', () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: 'https://example.com/some-dance' })], isLoading: false })
      renderDanceDetailPage()

      expect(screen.getByText('https://example.com/some-dance')).toBeInTheDocument()
    })

    it('shows a shortened "Caller\'s Box <id>" label for an ibiblio Caller\'s Box url', () => {
      useQueryMock.mockReturnValue({
        data: [makeDanceRow({ url: 'https://www.ibiblio.org/contradance/thecallersbox/dance.php?id=10320' })],
        isLoading: false,
      })
      renderDanceDetailPage()

      expect(screen.getByText("Caller's Box 10320")).toBeInTheDocument()
      expect(screen.queryByText('https://www.ibiblio.org/contradance/thecallersbox/dance.php?id=10320')).not.toBeInTheDocument()
    })

    it('shows a shortened "ContraDB <id>" label for a contradb.com url', () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: 'https://contradb.com/dances/1591' })], isLoading: false })
      renderDanceDetailPage()

      expect(screen.getByText('ContraDB 1591')).toBeInTheDocument()
      expect(screen.queryByText('https://contradb.com/dances/1591')).not.toBeInTheDocument()
    })

    it('shows the standard muted dash placeholder when there is no url, not a custom hint', () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: null })], isLoading: false })
      renderDanceDetailPage()

      // Three dashes: the empty url field, plus figures and videos, both
      // already empty by default in this fixture regardless of this test's own override.
      expect(screen.getAllByText('—')).toHaveLength(3)
      expect(screen.queryByText('Add a URL...')).not.toBeInTheDocument()
    })

    it('does not show an edit pencil when there is no url yet - there is nothing to navigate to', () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: null })], isLoading: false })
      renderDanceDetailPage()

      expect(screen.queryByRole('button', { name: 'Edit URL' })).not.toBeInTheDocument()
    })

    it('enters edit mode by clicking the placeholder dash itself when there is no url yet', async () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ id: '42', url: null })], isLoading: false })
      renderDanceDetailPage('42')

      // Scoped to the URL row specifically - figures/videos are also
      // empty-by-default in this fixture, so an unscoped "—" query would be ambiguous.
      const urlRow = screen.getByText('URL').closest('p')!
      const user = userEvent.setup()
      await user.click(within(urlRow).getByText('—'))
      const input = screen.getByRole('textbox')
      await user.type(input, 'https://example.com/new')
      await user.tab()

      expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET url = ? WHERE id = ?', ['https://example.com/new', '42'])
    })

    it('renders the value as a real link that opens the url in a new tab', () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: 'https://example.com/some-dance' })], isLoading: false })
      renderDanceDetailPage()

      const link = screen.getByRole('link', { name: 'https://example.com/some-dance' })
      expect(link).toHaveAttribute('href', 'https://example.com/some-dance')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it("truncates the link so a long url can't grow the sidebar column indefinitely", () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: 'https://example.com/some-dance' })], isLoading: false })
      renderDanceDetailPage()

      const link = screen.getByRole('link', { name: 'https://example.com/some-dance' })
      expect(link).toHaveClass('truncate', 'min-w-0', 'flex-1')
    })

    it('renders the value in normal (non-muted) text, with the same padding-driven spacing every other field value gets from the label', () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: 'https://example.com/some-dance' })], isLoading: false })
      renderDanceDetailPage()

      const link = screen.getByRole('link', { name: 'https://example.com/some-dance' })
      expect(link).toHaveClass('text-foreground', 'px-2.5', 'py-1')
      expect(link).not.toHaveClass('text-muted-foreground')
    })

    it('does not enter edit mode when the link itself is clicked - only the pencil does', async () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ url: 'https://example.com/some-dance' })], isLoading: false })
      renderDanceDetailPage()

      // jsdom doesn't navigate on a real link click, so this only needs to
      // confirm no editor appeared - the link's own href is covered above.
      await userEvent.setup().click(screen.getByRole('link', { name: 'https://example.com/some-dance' }))

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('commits an edited url through commitFieldEdit, opened via its own pencil button', async () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ id: '42', url: 'https://example.com/old' })], isLoading: false })
      renderDanceDetailPage('42')

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Edit URL' }))
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'https://example.com/new')
      await user.tab()

      expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET url = ? WHERE id = ?', ['https://example.com/new', '42'])
    })

    it('shows an edited url immediately after committing, bridging the gap before the query catches up', async () => {
      useQueryMock.mockReturnValue({ data: [makeDanceRow({ id: '42', url: 'https://example.com/old' })], isLoading: false })
      renderDanceDetailPage('42')

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Edit URL' }))
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'https://example.com/new')
      await user.tab()

      // The mocked query never actually updates dance.url after commit - if
      // this still shows the new link, the field is reading its own
      // optimistic draft rather than the (still-stale) value prop.
      expect(screen.getByRole('link', { name: 'https://example.com/new' })).toBeInTheDocument()
    })
  })

  it('sets the browser tab title to the dance\'s own title', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    renderDanceDetailPage()

    expect(document.title).toBe("Chorus Jig - Caller's Kit")
  })

  it('renders Added and Edited as compact "Label: value" lines, not through the standard field list', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow()], isLoading: false })
    renderDanceDetailPage()

    expect(screen.getByText('Added 1/15/26')).toBeInTheDocument()
    expect(screen.getByText('Edited 3/20/26')).toBeInTheDocument()
  })

  it('shows a muted placeholder instead of the "by ..." line when there are no choreographers, since the header is now an always-present editable field', () => {
    useQueryMock.mockReturnValue({ data: [makeDanceRow({ choreographers: '[]' })], isLoading: false })
    renderDanceDetailPage()

    // Scoped to the header block itself - the page can independently show
    // its own "—" for other empty fields (e.g. empty figures) that this
    // test isn't about.
    const header = screen.getByRole('heading', { name: 'Chorus Jig' }).closest('div')!
    expect(screen.queryByText(/^by /)).not.toBeInTheDocument()
    expect(within(header).getByText('—')).toBeInTheDocument()
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

    // Choreographers (header), Key Moves, Vibes, Figures, Programs, Videos,
    // URL - seven "—" placeholders. Notes is editable and shows
    // EditableRichText's own descriptive placeholder instead of the generic "—".
    expect(screen.getAllByText('—')).toHaveLength(7)
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
    // The page renders FiguresList in view mode by default - plain
    // parenthesized beats, not the editable-mode plain number.
    expect(screen.getAllByText('(8)')).toHaveLength(3)
    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(screen.getByText('Circle right')).toBeInTheDocument()
    expect(screen.getByText('Watch the timing here')).toBeInTheDocument()
    expect(screen.getByText('Swing')).toBeInTheDocument()
  })

  it('toggles the figures list between view and edit mode via the Edit figures button, showing Manual phrasing only in edit mode', async () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          dance_type: 'Contra',
          versions: JSON.stringify([
            {
              id: 'v1',
              label: 'Choreography',
              notes: null,
              manual_phrasing: 0,
              figures: [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }],
            },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    // View mode by default: no reorder/remove affordances, no Manual phrasing switch.
    expect(screen.queryByRole('button', { name: 'Reorder figure' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit figures' }))

    expect(screen.getByRole('button', { name: 'Reorder figure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add figure' })).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done editing figures' }))

    expect(screen.queryByRole('button', { name: 'Reorder figure' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('leaves figures edit mode on Escape when nothing on the page has focus, but not while something does', async () => {
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          dance_type: 'Contra',
          versions: JSON.stringify([
            {
              id: 'v1',
              label: 'Choreography',
              notes: null,
              manual_phrasing: 0,
              figures: [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }],
            },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit figures' }))

    // A focused plain button (e.g. the toggle itself, right after the click
    // that entered edit mode) doesn't count as "a field is focused" - only
    // a genuine text-editing surface does, simulated here with a plain
    // input rather than depending on some specific real field's own exact
    // Escape behavior.
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(screen.getByRole('button', { name: 'Done editing figures' })).toBeInTheDocument()
    input.remove()

    ;(document.activeElement as HTMLElement | null)?.blur()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(screen.queryByRole('button', { name: 'Reorder figure' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit figures' })).toBeInTheDocument()
  })

  it('does not also leave figures edit mode when Escape reverts a focused sub-field mid-edit', async () => {
    // The bug this guards against: a sub-field's own Escape handling
    // (revert the draft, unfocus/unmount back to display) completes
    // synchronously within the same event - by the time a plain bubble-
    // phase listener saw activeElement, the field would already be gone,
    // wrongly reading as "nothing is focused" and collapsing the whole
    // editor too. Dispatched on the actual focused input (not on window
    // directly) so it genuinely bubbles/captures the same way a real
    // keypress would.
    useQueryMock.mockReturnValue({
      data: [
        makeDanceRow({
          dance_type: 'Contra',
          versions: JSON.stringify([
            {
              id: 'v1',
              label: 'Choreography',
              notes: null,
              manual_phrasing: 0,
              figures: [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }],
            },
          ]),
        }),
      ],
      isLoading: false,
    })
    renderDanceDetailPage()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit figures' }))
    await user.click(screen.getByText('8'))
    const input = screen.getByRole('textbox')
    await user.type(input, '9')

    fireEvent.keyDown(input, { key: 'Escape' })

    // The sub-field itself reverted and closed - the typed edit discarded.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    // But the surrounding figures editor is still in edit mode - this
    // Escape belonged to the sub-field, not the page-level fallback.
    expect(screen.getByRole('button', { name: 'Done editing figures' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Edit notes' }))
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
