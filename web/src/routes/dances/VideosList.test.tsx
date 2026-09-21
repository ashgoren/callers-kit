import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VideosList } from './VideosList'
import type { Video } from '@/lib/videos'

describe('VideosList', () => {
  it('shows a placeholder when there are no items', () => {
    render(<VideosList items={[]} onChange={vi.fn()} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a drag handle and remove button per video', () => {
    const items: Video[] = [{ id: 'v1', url: 'https://example.com', description: 'Official teach' }]
    render(<VideosList items={items} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Reorder video' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove video' })).toBeInTheDocument()
  })

  it('keeps the drag handle out of the tab order - only mouse/touch dragging is supported, not keyboard', () => {
    // Also matters for VideosField's dialog specifically: as the first
    // tabbable element in the list, this was what Base UI's default
    // initialFocus put focus on when the dialog opened, which could eat
    // the first Escape press instead of closing the dialog.
    const items: Video[] = [{ id: 'v1', url: 'https://example.com', description: 'Official teach' }]
    render(<VideosList items={items} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Reorder video' })).toHaveAttribute('tabindex', '-1')
  })

  it('truncates both description and url to a single line, so a row never grows past one line', () => {
    const items: Video[] = [
      {
        id: 'v1',
        url: 'https://example.com/a-genuinely-very-long-url-that-would-otherwise-wrap',
        description: 'A genuinely very long description that would otherwise wrap onto a second line',
      },
    ]
    render(<VideosList items={items} onChange={vi.fn()} />)

    expect(screen.getByText(items[0].description)).toHaveClass('truncate', 'min-w-0')
    expect(screen.getByText(items[0].url)).toHaveClass('truncate', 'min-w-0')
  })

  it('adds a new blank video at the end via the Add video button', async () => {
    const onChange = vi.fn()
    const items: Video[] = [{ id: 'v1', url: 'https://example.com', description: 'Official teach' }]
    render(<VideosList items={items} onChange={onChange} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Add video' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as Video[]
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ url: '', description: '' })
    expect(result[1].id).toBeTruthy()
  })

  it('removes a video via its own remove button, by id', async () => {
    const onChange = vi.fn()
    const items: Video[] = [
      { id: 'v1', url: 'https://example.com/a', description: 'First' },
      { id: 'v2', url: 'https://example.com/b', description: 'Second' },
    ]
    render(<VideosList items={items} onChange={onChange} />)

    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Remove video' })[0])

    expect(onChange).toHaveBeenCalledWith([items[1]])
  })

  it("commits an edited description through onChange, by that video's own id", async () => {
    const onChange = vi.fn()
    const items: Video[] = [{ id: 'v1', url: 'https://example.com', description: 'Official teach' }]
    render(<VideosList items={items} onChange={onChange} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Official teach'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith([{ id: 'v1', url: 'https://example.com', description: 'Updated' }])
  })

  it('commits an edited url through onChange', async () => {
    const onChange = vi.fn()
    const items: Video[] = [{ id: 'v1', url: 'https://example.com/old', description: 'Official teach' }]
    render(<VideosList items={items} onChange={onChange} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('https://example.com/old'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'https://example.com/new')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith([{ id: 'v1', url: 'https://example.com/new', description: 'Official teach' }])
  })

  it('rejects an invalid url, leaving the field open with an error rather than committing', async () => {
    const onChange = vi.fn()
    const items: Video[] = [{ id: 'v1', url: 'https://example.com/old', description: 'Official teach' }]
    render(<VideosList items={items} onChange={onChange} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('https://example.com/old'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'not a url')
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })
})
