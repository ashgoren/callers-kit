import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditableRichText } from './EditableRichText'

// A plain contenteditable div doesn't get an implicit ARIA textbox role
// the way a native <input> does, and Tiptap doesn't add one itself - so
// the editor is queried directly by its contenteditable attribute rather
// than by role.
function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

describe('EditableRichText', () => {
  it('renders sanitized HTML in view mode, not yet as an editor', () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} />)

    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
    expect(getEditor()).not.toBeInTheDocument()
  })

  it('shows a muted placeholder in view mode when the value is null', () => {
    render(<EditableRichText value={null} onCommit={vi.fn()} placeholder="No notes yet" />)

    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('becomes an editor with a toolbar and Save/Cancel buttons once clicked', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))

    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('does nothing on blur - the field stays open with unsaved content intact', async () => {
    // Unlike every other Editable* field, blurring a large prose field is
    // deliberately a no-op: clicking/tapping outside shouldn't silently
    // commit or discard an effortful edit. Only Save, Cancel, or Escape do.
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    fireEvent.blur(getEditor()!)

    expect(onCommit).not.toHaveBeenCalled()
    expect(getEditor()).toBeInTheDocument()
    expect(getEditor()).toHaveTextContent('Bring extra chairs.')
  })

  it('commits typed content on Save, and returns to the read-only display', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith('<p>Bring extra chairs.</p>')
    await waitFor(() => expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument())
  })

  it('does not offer a numbered-list button - only bullet lists are supported', async () => {
    render(<EditableRichText value={null} onCommit={vi.fn()} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Numbered list' })).not.toBeInTheDocument()
  })

  it('commits a bulleted list as real <ul>/<li> markup', async () => {
    // Types the text first, then converts it to a list - not the other way
    // around. Converting an empty paragraph to a list first and typing into
    // it after relies on the cursor already sitting inside that empty list
    // item, which userEvent.type's own click-to-focus can't reliably
    // guarantee under jsdom (unlike toggling a mark like bold, which just
    // changes the stored marks for whatever gets typed next, not the
    // document structure itself).
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.type(getEditor()!, 'First item')
    await user.click(screen.getByRole('button', { name: 'Bullet list' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Tiptap always appends an empty paragraph after a document whose last
    // block isn't itself a paragraph (so there's somewhere to click below
    // it) - matches the same visual spacing a list already gets above it
    // from the list's own top margin, so it's kept rather than stripped out.
    expect(onCommit).toHaveBeenCalledWith('<ul><li><p>First item</p></li></ul><p></p>')
  })

  it('commits null, not an empty paragraph, when the last remaining content is deleted before saving', async () => {
    // Guards the isEmpty-to-null normalization in currentHtml() specifically
    // on the way back to empty, not just on the way from it - a plain
    // "<p></p>" here would otherwise show as a real, non-placeholder value
    // the next time the field is viewed.
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.click(getEditor()!)
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith(null)
  })

  it('toggles bold from the toolbar, reflected in both the active state and the committed HTML', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    const boldButton = screen.getByRole('button', { name: 'Bold' })
    expect(boldButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(boldButton)
    expect(boldButton).toHaveAttribute('aria-pressed', 'true')

    await user.type(getEditor()!, 'Important')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith('<p><strong>Important</strong></p>')
  })

  it('closes immediately on Cancel with no prompt, when nothing was actually changed', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
  })

  it('closes immediately on Escape with no prompt, when nothing was actually changed', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    fireEvent.keyDown(getEditor()!, { key: 'Escape' })

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('arms a discard prompt on the first Cancel click, without closing or committing', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument()
    expect(getEditor()).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
    // The button re-labels itself once armed, so the destructive action is
    // discoverable without a separate button appearing out of nowhere.
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('discards on a second Cancel/Discard click, without committing', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await screen.findByText('Discard your changes?')
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('discards on a second, immediate Escape, without committing', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')

    fireEvent.keyDown(getEditor()!, { key: 'Escape' })
    await screen.findByText('Discard your changes?')
    fireEvent.keyDown(getEditor()!, { key: 'Escape' })

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('clears an armed discard prompt when typing continues, instead of forcing a choice', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await screen.findByText('Discard your changes?')

    await user.type(getEditor()!, ' - actually keep this')

    expect(screen.queryByText('Discard your changes?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit a blur that races in while a discard prompt is showing', async () => {
    // With blur now a genuine no-op (see the dedicated blur test above),
    // this is really just confirming that guarantee still holds once a
    // discard prompt is armed - not a special case, but the scenario that
    // used to be a real bug under the old blur-commits design.
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await screen.findByText('Discard your changes?')
    fireEvent.blur(getEditor()!)

    expect(onCommit).not.toHaveBeenCalled()
    expect(getEditor()).toBeInTheDocument()
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
  })
})
