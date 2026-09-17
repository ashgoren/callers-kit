import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { hasUnsavedRichText } from '@/lib/unsavedRichText'
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

  it('uses the compact prose-sm scale by default, in both view and edit mode', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} />)

    expect(screen.getByText('Bring extra chairs.').parentElement).toHaveClass('prose-sm')

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))

    expect(getEditor()?.parentElement).toHaveClass('prose-sm')
  })

  it('uses the larger base prose scale when size="base" is passed, in both view and edit mode', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} size="base" />)

    expect(screen.getByText('Bring extra chairs.').parentElement).not.toHaveClass('prose-sm')

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))

    expect(getEditor()?.parentElement).not.toHaveClass('prose-sm')
  })

  it('shows a muted placeholder in view mode when the value is null', () => {
    render(<EditableRichText value={null} onCommit={vi.fn()} placeholder="No notes yet" />)

    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('shows the same placeholder when the value is an empty string, not just null', () => {
    // Real production data confirmed this isn't hypothetical - the old
    // app's editor saved '' rather than leaving the column null, so every
    // dance without notes has an empty string, not a null one. Without
    // this, the field renders a blank, unclickable-looking area instead of
    // an inviting "click to add notes" placeholder.
    render(<EditableRichText value="" onCommit={vi.fn()} placeholder="No notes yet" />)

    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('closes immediately on Cancel with no prompt, when the starting value is an empty string and nothing was typed', async () => {
    // Guards the same '' vs null gap from the other direction: without
    // normalizing '' to null up front, attemptCancel would compare the
    // editor's genuinely-empty current content (null) against the raw ''
    // prop, see a "change," and wrongly arm a discard prompt for a field
    // the user never actually touched.
    const onCommit = vi.fn()
    render(<EditableRichText value="" onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
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

  it('disables Save until the content actually differs from the last saved value', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.type(getEditor()!, ' And cups.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    // Deleting back to the original content disables it again - this is a
    // live comparison against the current value, not a one-time "has this
    // field been touched at all" flag.
    await user.keyboard('{Backspace>10/}')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('re-disables Save after a Cmd/Ctrl-S checkpoint, until something changes again', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    fireEvent.keyDown(getEditor()!, { key: 's', ctrlKey: true })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('registers with the app-wide unsaved-content tracker while dirty, and deregisters once saved or closed', async () => {
    // AppShell's navigation guard (useBlocker/useBeforeUnload) reads this
    // same registry - this only needs to confirm EditableRichText holds up
    // its end of that contract, not re-test the registry's own logic
    // (covered directly in unsavedRichText.test.ts) or AppShell's behavior
    // (covered in AppShell.test.tsx).
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)
    expect(hasUnsavedRichText()).toBe(false)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    expect(hasUnsavedRichText()).toBe(false) // opened, but nothing typed yet

    await user.type(getEditor()!, 'Bring extra chairs.')
    expect(hasUnsavedRichText()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(hasUnsavedRichText()).toBe(false)
  })

  it('deregisters from the unsaved-content tracker when a dirty field is discarded, not just saved', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')
    expect(hasUnsavedRichText()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Cancel' })) // arms the discard prompt
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(hasUnsavedRichText()).toBe(false)
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

  it('checkpoints on Cmd/Ctrl-S without closing the editor', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    fireEvent.keyDown(getEditor()!, { key: 's', ctrlKey: true })

    expect(onCommit).toHaveBeenCalledWith('<p>Bring extra chairs.</p>')
    expect(getEditor()).toBeInTheDocument()
    expect(getEditor()).toHaveTextContent('Bring extra chairs.')
  })

  it('a Cancel after a Cmd/Ctrl-S checkpoint only discards what changed since, closing with no prompt if nothing did', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    fireEvent.keyDown(getEditor()!, { key: 's', ctrlKey: true })
    onCommit.mockClear()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
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

  it('inserts a horizontal rule from the toolbar', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await user.click(screen.getByText('No notes yet'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.type(getEditor()!, 'Before')
    await user.click(screen.getByRole('button', { name: 'Horizontal rule' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith('<p>Before</p><hr><p></p>')
  })

  it('does not show the selection bubble menu until text is actually selected', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    expect(screen.queryByRole('toolbar', { name: 'Selection formatting' })).not.toBeInTheDocument()
  })

  it('shows a selection bubble menu with the same mark/heading/list actions once text is selected, but not Horizontal rule', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(getEditor()!)
    await user.keyboard('{Control>}a{/Control}')

    const bubble = await screen.findByRole('toolbar', { name: 'Selection formatting' })
    expect(within(bubble).getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Underline' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Heading 1' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Heading 2' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Bullet list' })).toBeInTheDocument()
    // Inserts a new node rather than acting on a selection, so it doesn't
    // belong in a menu that only ever appears because text is selected.
    expect(within(bubble).queryByRole('button', { name: 'Horizontal rule' })).not.toBeInTheDocument()
  })

  it('toggles bold from the selection bubble menu, reflected in the committed HTML', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(getEditor()!)
    await user.keyboard('{Control>}a{/Control}')
    const bubble = await screen.findByRole('toolbar', { name: 'Selection formatting' })

    await user.click(within(bubble).getByRole('button', { name: 'Bold' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith('<p><strong>Bring extra chairs.</strong></p>')
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
