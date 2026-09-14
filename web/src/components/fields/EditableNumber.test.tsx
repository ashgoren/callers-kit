import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { EditableNumber } from './EditableNumber'

describe('EditableNumber', () => {
  it('renders the value as plain text, not yet as a textbox', () => {
    render(<EditableNumber value={3} onCommit={vi.fn()} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows a muted placeholder in the plain-text display when the value is null', () => {
    render(<EditableNumber value={null} onCommit={vi.fn()} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('becomes a textbox once clicked, focused and pre-filled with the current value', async () => {
    render(<EditableNumber value={3} onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('3'))

    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('3')
    expect(input).toHaveFocus()
  })

  it('commits the typed value on blur, and returns to plain-text display', async () => {
    const onCommit = vi.fn()
    render(<EditableNumber value={3} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('3'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '5')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith(5)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('commits null when the value is cleared entirely, rather than being blocked or defaulting to zero', async () => {
    const onCommit = vi.fn()
    render(<EditableNumber value={3} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('3'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith(null)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('reverts to the original value on Escape, without committing', async () => {
    const onCommit = vi.fn()
    render(<EditableNumber value={3} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('3'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '9')
    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows a validation error and stays a textbox when the schema rejects the value', async () => {
    const onCommit = vi.fn()
    render(
      <EditableNumber value={3} onCommit={onCommit} schema={z.number().int().min(0, 'Must be 0 or more').nullable()} />,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('3'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '-5')
    await user.tab()

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Must be 0 or more')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('activates edit mode on Enter when focused via keyboard', async () => {
    render(<EditableNumber value={3} onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.tab()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.keyboard('{Enter}')

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
