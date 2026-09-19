import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { EditableText } from './EditableText'

describe('EditableText', () => {
  it('renders the value as plain text, not yet as a textbox', () => {
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={vi.fn()} />)

    expect(screen.getByText('Chorus Jig')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('becomes a textbox once clicked, focused and pre-filled with the current value', async () => {
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Chorus Jig'))

    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Chorus Jig')
    expect(input).toHaveFocus()
  })

  it('commits the typed value on blur, and returns to plain-text display', async () => {
    const onCommit = vi.fn()
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Chorus Jig'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Money Musk')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith('Money Musk')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('reverts to the original value on Escape, without committing', async () => {
    const onCommit = vi.fn()
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Chorus Jig'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Abandoned edit')
    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Chorus Jig')).toBeInTheDocument()
  })

  it('shows a validation error and stays a textbox when the schema rejects the value', async () => {
    const onCommit = vi.fn()
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={onCommit} schema={z.string().min(1, 'Title is required')} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Chorus Jig'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.tab()

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', screen.getByText('Title is required').id)
  })

  it('keeps real focus on the textbox after a blur-triggered validation failure, so Escape reverts without clicking again', async () => {
    const onCommit = vi.fn()
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={onCommit} schema={z.string().min(1, 'Title is required')} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Chorus Jig'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.tab()

    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Chorus Jig')).toBeInTheDocument()
  })

  it('shows a muted placeholder in the plain-text display when the value is empty', () => {
    render(<EditableText fullWidth={false} value="" onCommit={vi.fn()} placeholder="Untitled" />)

    expect(screen.getByText('Untitled')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('keeps the wrapper\'s data-value attribute (the ghost\'s sizing content) in sync as the draft changes', async () => {
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Chorus Jig'))
    const input = screen.getByRole('textbox')

    // jsdom can't verify the ghost's actual rendered width (there's no real
    // layout engine), but this attribute is what drives it in a real
    // browser, and is worth confirming actually tracks keystrokes.
    expect(input.parentElement).toHaveAttribute('data-value', 'Chorus Jig')

    await user.type(input, '!')

    expect(input.parentElement).toHaveAttribute('data-value', 'Chorus Jig!')
  })

  it('falls back to the placeholder for the wrapper\'s data-value when both the draft and placeholder are empty', async () => {
    render(<EditableText fullWidth={false} value="" onCommit={vi.fn()} placeholder="Untitled" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Untitled'))

    expect(screen.getByRole('textbox').parentElement).toHaveAttribute('data-value', 'Untitled')
  })

  it('stays inline-block in edit mode, matching the read-mode display, so a sibling sharing its line does not reflow', async () => {
    // Regression guard: the edit-mode wrapper used to be unconditionally
    // block regardless of fullWidth, so entering edit mode on a
    // content-sized field forced a line break where read mode didn't -
    // e.g. a dance title and its choreographers line jumping apart the
    // moment either one was clicked into edit mode.
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={vi.fn()} />)

    expect(screen.getByText('Chorus Jig')).toHaveClass('inline-block')

    await userEvent.setup().click(screen.getByText('Chorus Jig'))

    const editModeWrapper = screen.getByRole('textbox').parentElement?.parentElement
    expect(editModeWrapper).toHaveClass('inline-block')
    expect(editModeWrapper).not.toHaveClass('block')
  })

  it('activates edit mode on Enter when focused via keyboard', async () => {
    render(<EditableText fullWidth={false} value="Chorus Jig" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.tab()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.keyboard('{Enter}')

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  describe('fullWidth mode', () => {
    it('renders the value as plain text, not yet as a textbox', () => {
      render(<EditableText fullWidth value="A1" onCommit={vi.fn()} />)

      expect(screen.getByText('A1')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('becomes a textbox once clicked, pre-filled with the current value, and commits on blur', async () => {
      const onCommit = vi.fn()
      render(<EditableText fullWidth value="A1" onCommit={onCommit} />)

      const user = userEvent.setup()
      await user.click(screen.getByText('A1'))
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('A1')

      await user.clear(input)
      await user.type(input, 'Verse')
      await user.tab()

      expect(onCommit).toHaveBeenCalledWith('Verse')
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('stays block in edit mode, matching the read-mode display', async () => {
      render(<EditableText fullWidth value="A1" onCommit={vi.fn()} />)

      expect(screen.getByText('A1')).toHaveClass('block')

      await userEvent.setup().click(screen.getByText('A1'))

      expect(screen.getByRole('textbox').parentElement).toHaveClass('block')
    })

    it('skips the content-sizing ghost wrapper entirely - the input has no sizing-related parent element', async () => {
      render(<EditableText fullWidth value="A1" onCommit={vi.fn()} />)

      await userEvent.setup().click(screen.getByText('A1'))

      // Content-sized mode's input sits inside a div carrying data-value
      // (the ghost-sizing wrapper) - fullWidth mode has no such wrapper at all.
      expect(screen.getByRole('textbox')).not.toHaveAttribute('data-value')
      expect(screen.getByRole('textbox').parentElement).not.toHaveAttribute('data-value')
    })
  })
})
