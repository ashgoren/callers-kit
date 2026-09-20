import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VideosField } from './VideosField'
import type { Video } from '@/lib/videos'

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit videos' }))
}

describe('VideosField', () => {
  it('shows a placeholder when there are no videos', () => {
    render(<VideosField value={[]} onCommit={vi.fn()} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders each video as a link to its url, using its description as the link text', () => {
    const videos: Video[] = [{ id: 'v1', url: 'https://example.com/a', description: 'Official teach' }]
    render(<VideosField value={videos} onCommit={vi.fn()} />)

    const link = screen.getByRole('link', { name: 'Official teach' })
    expect(link).toHaveAttribute('href', 'https://example.com/a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it("sizes the link's own box to its (truncated) text, not the full row - inline-block, not block", () => {
    // Guards against a block/w-full link, which would make the empty space
    // beside a short description clickable too - only the visible text
    // itself should open the video.
    const videos: Video[] = [{ id: 'v1', url: 'https://example.com/a', description: 'Official teach' }]
    render(<VideosField value={videos} onCommit={vi.fn()} />)

    const link = screen.getByRole('link', { name: 'Official teach' })
    expect(link).toHaveClass('inline-block', 'max-w-full', 'truncate')
    expect(link).not.toHaveClass('block', 'w-full')
  })

  it('falls back to a generic link label when a video has no description', () => {
    const videos: Video[] = [{ id: 'v1', url: 'https://example.com/a', description: '' }]
    render(<VideosField value={videos} onCommit={vi.fn()} />)

    expect(screen.getByRole('link', { name: 'Video' })).toBeInTheDocument()
  })

  it('does not show the editor dialog until the pencil is clicked', () => {
    render(<VideosField value={[]} onCommit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Add video' })).not.toBeInTheDocument()
  })

  it('opens the editor dialog, seeded with the current videos, on pencil click', async () => {
    const videos: Video[] = [{ id: 'v1', url: 'https://example.com/a', description: 'Official teach' }]
    render(<VideosField value={videos} onCommit={vi.fn()} />)

    await openEditor(userEvent.setup())

    const dialog = screen.getByRole('dialog', { name: 'Videos' })
    expect(within(dialog).getByText('Official teach')).toBeInTheDocument()
  })

  it('does not commit anything just from editing inside the dialog - only Save does', async () => {
    const onCommit = vi.fn()
    render(<VideosField value={[]} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    await user.click(screen.getByRole('button', { name: 'Add video' }))

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits the edited array on Save, and closes the dialog', async () => {
    const onCommit = vi.fn()
    render(<VideosField value={[]} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    await user.click(screen.getByRole('button', { name: 'Add video' }))
    await user.click(screen.getByText('https://…'))
    await user.type(screen.getByRole('textbox'), 'https://example.com/new')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledTimes(1)
    const result = onCommit.mock.calls[0][0] as Video[]
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ url: 'https://example.com/new', description: '' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('disables Save while any video is missing a url, re-enabling once every video has one', async () => {
    const onCommit = vi.fn()
    render(<VideosField value={[]} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    await user.click(screen.getByRole('button', { name: 'Add video' }))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.click(screen.getByText('https://…'))
    await user.type(screen.getByRole('textbox'), 'https://example.com/new')
    await user.tab()

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('does not close the dialog on Escape while editing one of its own fields - only reverts that field', async () => {
    const onCommit = vi.fn()
    const videos: Video[] = [{ id: 'v1', url: 'https://example.com/a', description: 'Official teach' }]
    render(<VideosField value={videos} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    const dialog = screen.getByRole('dialog', { name: 'Videos' })
    await user.click(within(dialog).getByText('Official teach'))
    await user.type(screen.getByRole('textbox'), ' extra')
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Videos' })).toBeInTheDocument()
    expect(within(dialog).getByText('Official teach')).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('closes immediately on Cancel with no prompt, when nothing was changed', async () => {
    const onCommit = vi.fn()
    const videos: Video[] = [{ id: 'v1', url: 'https://example.com/a', description: 'Official teach' }]
    render(<VideosField value={videos} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('arms a discard prompt on the first Cancel click after a real change, without closing or committing', async () => {
    const onCommit = vi.fn()
    render(<VideosField value={[]} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    await user.click(screen.getByRole('button', { name: 'Add video' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('discards on a second Cancel/Discard click, without committing, and reverts the read-only view', async () => {
    const onCommit = vi.fn()
    render(<VideosField value={[]} onCommit={onCommit} />)

    const user = userEvent.setup()
    await openEditor(user)
    await user.click(screen.getByRole('button', { name: 'Add video' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await screen.findByText('Discard your changes?')
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    // Reopening starts fresh from the original (still empty) value, not the abandoned draft.
    await openEditor(userEvent.setup())
    expect(screen.queryByRole('button', { name: 'Remove video' })).not.toBeInTheDocument()
  })
})
