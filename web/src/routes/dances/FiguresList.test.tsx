import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FiguresList } from './FiguresList'

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
})
