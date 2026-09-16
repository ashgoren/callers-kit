import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import { DanceWalkthroughPage } from './DanceWalkthroughPage'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

function renderDanceWalkthroughPage(versionId = 'v1') {
  const router = createMemoryRouter(
    [
      { path: '/dances/:id/versions/:versionId/walkthrough', element: <DanceWalkthroughPage /> },
      { path: '/dances/:id/versions/:versionId', element: <p>Dance detail page</p> },
      { path: '/dances/:id', element: <p>Dance detail page</p> },
    ],
    { initialEntries: [`/dances/42/versions/${versionId}/walkthrough`] },
  )
  return render(<RouterProvider router={router} />)
}

// order: 0 (the primary version) by default - see the dedicated test below
// for the non-primary case, which links back differently.
function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    order: 0,
    label: 'Choreography',
    walkthrough: '<p>Walk it through slowly.</p>',
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

describe('DanceWalkthroughPage', () => {
  it('shows a loading state while the query is in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    renderDanceWalkthroughPage()

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows a not-found message when no version matches the id', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    renderDanceWalkthroughPage('missing')

    expect(screen.getByText('Dance version not found.')).toBeInTheDocument()
  })

  it('shows the dance title, figures label, and a link back to the dance', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow()], isLoading: false })
    renderDanceWalkthroughPage()

    // Title + choreographers/formation share one heading, so its accessible
    // name includes all of it - matched by prefix rather than the exact
    // combined string, since choreographers/formation vary per test below.
    expect(screen.getByRole('heading', { name: /^Chorus Jig/ })).toBeInTheDocument()
    expect(screen.getByText('Becket')).toBeInTheDocument()
    expect(screen.getByText('Walk it through slowly.')).toBeInTheDocument()
    // Single-version dance - nothing to disambiguate, so no version label.
    expect(screen.queryByText('Version: Choreography')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Back to dance' }))

    expect(await screen.findByText('Dance detail page')).toBeInTheDocument()
  })

  it('links back to the short /dances/:id form for the primary version', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ order: 0 })], isLoading: false })
    renderDanceWalkthroughPage()

    expect(screen.getByRole('link', { name: 'Back to dance' })).toHaveAttribute('href', '/dances/42')
  })

  it('links back to that version\'s own qualified URL when it is not the primary version', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ order: 1 })], isLoading: false })
    renderDanceWalkthroughPage()

    expect(screen.getByRole('link', { name: 'Back to dance' })).toHaveAttribute('href', '/dances/42/versions/v1')
  })

  it('bolds the figures label when it\'s anything other than the common Improper case', () => {
    useQueryMock.mockReturnValue({
      data: [makeVersionRow({ dance_type: 'Square', formation: 'Duple Minor - Becket', progression: 'Double' })],
      isLoading: false,
    })
    renderDanceWalkthroughPage()

    expect(screen.getByText('Square · Becket · Double progression')).toHaveClass('font-semibold')
  })

  it('does not bold the figures label for the common Improper case', () => {
    useQueryMock.mockReturnValue({
      data: [makeVersionRow({ dance_type: 'Contra', formation: 'Duple Minor - Improper', progression: 'Single' })],
      isLoading: false,
    })
    renderDanceWalkthroughPage()

    expect(screen.getByText('Improper')).not.toHaveClass('font-semibold')
  })

  it('shows the version label when the dance has more than one version', () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ version_count: 2 })], isLoading: false })
    renderDanceWalkthroughPage()

    expect(screen.getByText('Version: Choreography')).toBeInTheDocument()
  })

  it('shows choreographers when the dance has any, without a figures label to combine with', () => {
    useQueryMock.mockReturnValue({
      data: [
        makeVersionRow({
          choreographers: JSON.stringify(['Bob', 'Alice']),
          dance_type: null,
          formation: null,
          progression: null,
        }),
      ],
      isLoading: false,
    })
    renderDanceWalkthroughPage()

    // sortAlphabetically, same as DanceDetailPage's own byline.
    expect(screen.getByText('by Alice, Bob')).toBeInTheDocument()
  })

  it('links the dance title itself back to the dance too', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow()], isLoading: false })
    renderDanceWalkthroughPage()

    const user = userEvent.setup()
    await user.click(screen.getByRole('heading', { name: /^Chorus Jig/ }))

    expect(await screen.findByText('Dance detail page')).toBeInTheDocument()
  })

  it('commits an edited walkthrough through commitFieldEdit, by that version\'s own id', async () => {
    useQueryMock.mockReturnValue({ data: [makeVersionRow({ walkthrough: null })], isLoading: false })
    renderDanceWalkthroughPage()

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    const editor = document.querySelector('[contenteditable="true"]')
    await waitFor(() => expect(editor).toBeInTheDocument())
    await user.type(editor!, 'Circle left, then swing.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET walkthrough = ? WHERE id = ?', [
      '<p>Circle left, then swing.</p>',
      'v1',
    ])
  })
})
