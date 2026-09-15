import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditableDate } from './EditableDate'

describe('EditableDate', () => {
  it('renders the value as a human-formatted date, not yet as an input', () => {
    render(<EditableDate value="2026-09-13" onCommit={vi.fn()} />)

    expect(screen.getByText('9/13/26')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('2026-09-13')).not.toBeInTheDocument()
  })

  it('shows the "No date" placeholder in the plain-text display when the value is null', () => {
    render(<EditableDate value={null} onCommit={vi.fn()} />)

    expect(screen.getByText('No date')).toBeInTheDocument()
  })

  it('supports a custom placeholder', () => {
    render(<EditableDate value={null} onCommit={vi.fn()} placeholder="Not yet scheduled" />)

    expect(screen.getByText('Not yet scheduled')).toBeInTheDocument()
  })

  it('becomes a date input once clicked, focused and pre-filled with the current ISO value', async () => {
    render(<EditableDate value="2026-09-13" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('9/13/26'))

    const input = screen.getByDisplayValue('2026-09-13')
    expect(input).toHaveAttribute('type', 'date')
    expect(input).toHaveFocus()
  })

  it('commits the new ISO date on blur, and returns to the formatted display', async () => {
    // fireEvent.change, not userEvent.type - userEvent's keystroke-by-
    // keystroke simulation doesn't reliably fill a native date input's
    // segmented (month/day/year) UI in jsdom the way a real browser does.
    const onCommit = vi.fn()
    render(<EditableDate value="2026-09-13" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('9/13/26'))
    const input = screen.getByDisplayValue('2026-09-13')
    fireEvent.change(input, { target: { value: '2026-10-20' } })
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith('2026-10-20')
    expect(screen.getByText('10/20/26')).toBeInTheDocument()
  })

  it('commits null when the date is cleared entirely, rather than being blocked', async () => {
    const onCommit = vi.fn()
    render(<EditableDate value="2026-09-13" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('9/13/26'))
    const input = screen.getByDisplayValue('2026-09-13')
    await user.clear(input)
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith(null)
    expect(screen.getByText('No date')).toBeInTheDocument()
  })

  it('reverts to the original value on Escape, without committing', async () => {
    const onCommit = vi.fn()
    render(<EditableDate value="2026-09-13" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('9/13/26'))
    const input = screen.getByDisplayValue('2026-09-13')
    fireEvent.change(input, { target: { value: '2026-10-20' } })
    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('9/13/26')).toBeInTheDocument()
  })
})
