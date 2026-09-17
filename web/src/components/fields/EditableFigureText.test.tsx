import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditableFigureText } from './EditableFigureText'

// A plain contenteditable div doesn't get an implicit ARIA textbox role -
// see EditableRichText.test.tsx's own identical helper.
function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

describe('EditableFigureText', () => {
  it('renders sanitized HTML in view mode, not yet as an editor', () => {
    render(<EditableFigureText value="<p>Circle left</p>" onCommit={vi.fn()} />)

    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(getEditor()).not.toBeInTheDocument()
  })

  it('shows a placeholder in view mode when the value is null', () => {
    render(<EditableFigureText value={null} onCommit={vi.fn()} placeholder="Add a figure…" />)

    expect(screen.getByText('Add a figure…')).toBeInTheDocument()
  })

  it('commits an edit on blur', async () => {
    const onCommit = vi.fn()
    render(<EditableFigureText value="<p>Circle left</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, ' fast')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith('<p>Circle left fast</p>')
  })

  it('commits on a plain Enter, rather than starting a new line', async () => {
    const onCommit = vi.fn()
    render(<EditableFigureText value="<p>Circle left</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, ' fast{Enter}')

    expect(onCommit).toHaveBeenCalledWith('<p>Circle left fast</p>')
  })

  it('does not commit on Shift+Enter - it inserts a line break instead', async () => {
    const onCommit = vi.fn()
    render(<EditableFigureText value="<p>Circle left</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, '{Shift>}{Enter}{/Shift}fast')

    expect(onCommit).not.toHaveBeenCalled()
    expect(getEditor()?.innerHTML).toContain('<br')
  })

  it('parses the old app\'s legacy <font size="2"> tag as the same mark the modern editor writes', async () => {
    const onCommit = vi.fn()
    render(<EditableFigureText value='<p><font size="2">small text</font></p>' onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('small text'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, '!')
    await user.tab()

    // Re-serializes through the modern <span style="font-size:..."> form,
    // proving the legacy tag parsed into the same underlying mark rather
    // than being dropped or ignored - not just carried through unchanged.
    expect(onCommit).toHaveBeenCalledWith('<p><span style="font-size: 0.8em;">small text!</span></p>')
  })
})
