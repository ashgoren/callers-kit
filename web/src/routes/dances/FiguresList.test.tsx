import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FiguresList } from './FiguresList'

function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

describe('FiguresList', () => {
  it('shows a placeholder when there are no items', () => {
    render(<FiguresList items={[]} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a figure\'s description as HTML', () => {
    render(<FiguresList items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle <strong>left</strong></p>' }]} />)

    expect(screen.getByText('left').tagName).toBe('STRONG')
  })

  it('strips unsafe markup from a figure\'s description before rendering it', () => {
    render(
      <FiguresList
        items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p><script>window.pwned = true</script>' }]}
      />,
    )

    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(document.querySelector('script')).not.toBeInTheDocument()
  })

  it('strips unsafe markup from an interspersed note before rendering it', () => {
    render(<FiguresList items={[{ id: 'n1', kind: 'note', text: '<p>Watch the timing</p><img src="x" onerror="window.pwned = true">' }]} />)

    expect(screen.getByText('Watch the timing')).toBeInTheDocument()
    const img = document.querySelector('img')
    expect(img).not.toHaveAttribute('onerror')
  })

  it('commits an edited figure description through onEditItem, by that figure\'s own id', async () => {
    const onEditItem = vi.fn()
    render(
      <FiguresList
        items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }]}
        onEditItem={onEditItem}
      />,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, ' fast')
    await user.tab()

    expect(onEditItem).toHaveBeenCalledWith('f1', '<p>Circle left fast</p>')
  })

  it('commits edited note text through onEditItem, by that note\'s own id', async () => {
    const onEditItem = vi.fn()
    render(<FiguresList items={[{ id: 'n1', kind: 'note', text: '<p>Watch the timing</p>' }]} onEditItem={onEditItem} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Watch the timing'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, ' here')
    await user.tab()

    expect(onEditItem).toHaveBeenCalledWith('n1', '<p>Watch the timing here</p>')
  })

  it('does nothing when an item is edited but no onEditItem callback was given', async () => {
    render(<FiguresList items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, ' fast')

    // No assertion beyond "doesn't throw" - onEditItem is optional, and a
    // read-only rendering (if one's ever needed) shouldn't have to supply a no-op.
    await user.tab()
  })
})
