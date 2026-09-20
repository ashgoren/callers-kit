import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { hasUnsavedRichText } from '@/lib/unsavedRichText'
import { getLatestIntersectionObserverCallback } from '@/test-setup'
import { EditableRichText } from './EditableRichText'

// A plain contenteditable div doesn't get an implicit ARIA textbox role
// the way a native <input> does, and Tiptap doesn't add one itself - so
// the editor is queried directly by its contenteditable attribute rather
// than by role.
function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

// jsdom has no real layout, so there's no genuine on/off-screen state to
// trigger - this drives the resume-editing pill's IntersectionObserver
// callback directly, the same way a real observer would report a change.
// top defaults to above the viewport (matching most of these tests, which
// don't care which direction it reports) - see the dedicated direction test
// below for a case that does. Wrapped in act() since, unlike a state update
// from fireEvent/user-event, calling this callback directly isn't something
// React Testing Library already knows to flush before the next assertion.
function simulateIntersection(isIntersecting: boolean, top = -1) {
  const callback = getLatestIntersectionObserverCallback()
  act(() => {
    callback?.([{ isIntersecting, boundingClientRect: { top } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

// Every test renders with this same fieldName - its exact wording is a
// caller concern (see the real "notes"/"walkthrough" values at each call
// site), not something these tests need to vary.
const FIELD_NAME = 'notes'

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: `Edit ${FIELD_NAME}` }))
}

describe('EditableRichText', () => {
  it('renders sanitized HTML in view mode, not yet as an editor', () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
    expect(getEditor()).not.toBeInTheDocument()
  })

  it('does not enter edit mode when the displayed content itself is clicked - only the edit button does', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Bring extra chairs.'))

    expect(getEditor()).not.toBeInTheDocument()
  })

  it('uses the compact prose-sm scale by default, in both view and edit mode', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    expect(screen.getByText('Bring extra chairs.').parentElement).toHaveClass('prose-sm')

    const user = userEvent.setup()
    await openEditor(user)

    expect(getEditor()?.parentElement).toHaveClass('prose-sm')
  })

  it('uses the larger base prose scale when size="base" is passed, in both view and edit mode', async () => {
    render(
      <EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} size="base" />,
    )

    expect(screen.getByText('Bring extra chairs.').parentElement).not.toHaveClass('prose-sm')

    const user = userEvent.setup()
    await openEditor(user)

    expect(getEditor()?.parentElement).not.toHaveClass('prose-sm')
  })

  // These only confirm the right classes land on the right elements given
  // the prop - jsdom has no real layout engine (and doesn't evaluate media
  // queries at all), so it can't verify the box actually bounds/scrolls in
  // a browser at either breakpoint the way it's meant to (that's covered
  // separately in e2e). What this guards against is a future refactor
  // silently breaking the conditional itself - e.g. dropping min-h-0
  // somewhere in the chain, which would compile and pass every other test
  // here but quietly stop the whole thing from working.
  //
  // Below sm:, this field always grows with its content and the page
  // scrolls - no height/overflow classes apply at all, regardless of
  // fillHeight. Only sm: and up bounds it, either to a fixed max-height
  // (default) or to the page's own remaining height (fillHeight).
  it('bounds edit-mode content with a fixed max-height at sm: and up by default, and no bound at all below that', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)

    expect(getEditor()?.parentElement).not.toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    expect(getEditor()?.parentElement).toHaveClass('sm:max-h-96', 'sm:overflow-y-auto')
  })

  it('fills and scrolls within its container at sm: and up when fillHeight is passed, with no bound below that', async () => {
    render(
      <EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} fillHeight />,
    )

    const user = userEvent.setup()
    await openEditor(user)

    // EditorContent's own wrapper: no height/overflow classes below sm:,
    // and fills+scrolls the remaining flex space at sm: and up.
    expect(getEditor()?.parentElement).not.toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'sm:max-h-96')
    expect(getEditor()?.parentElement).toHaveClass('sm:min-h-0', 'sm:flex-1', 'sm:overflow-y-auto')
    // RichTextEditArea's own root: only a flex column at sm: and up, so
    // that fill-height child has something to fill - a plain block below
    // that, growing normally with the page.
    expect(getEditor()?.parentElement?.parentElement).not.toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col')
    expect(getEditor()?.parentElement?.parentElement).toHaveClass('sm:flex', 'sm:min-h-0', 'sm:flex-1', 'sm:flex-col')
    // EditableRichText's own edit-mode wrapper: a flex column filling the
    // page at sm: and up; nothing at all below that.
    const outerWrapper = getEditor()?.parentElement?.parentElement?.parentElement
    expect(outerWrapper).toHaveClass('sm:flex', 'sm:h-full', 'sm:flex-col')
  })

  it('shows a muted placeholder in view mode when the value is null', () => {
    render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('shows the same placeholder when the value is an empty string, not just null', () => {
    // Real production data confirmed this isn't hypothetical - the old
    // app's editor saved '' rather than leaving the column null, so every
    // dance without notes has an empty string, not a null one. Without
    // this, the field renders a blank, unclickable-looking area instead of
    // an inviting "click to add notes" placeholder.
    render(<EditableRichText value="" onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('closes immediately on Cancel with no prompt, when the starting value is an empty string and nothing was typed', async () => {
    // Guards the same '' vs null gap from the other direction: without
    // normalizing '' to null up front, attemptCancel would compare the
    // editor's genuinely-empty current content (null) against the raw ''
    // prop, see a "change," and wrongly arm a discard prompt for a field
    // the user never actually touched.
    const onCommit = vi.fn()
    render(<EditableRichText value="" onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('becomes an editor with a toolbar and Save/Cancel buttons once its edit button is clicked', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)

    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('disables Save until the content actually differs from the last saved value', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)
    expect(hasUnsavedRichText()).toBe(false)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    expect(hasUnsavedRichText()).toBe(false) // opened, but nothing typed yet

    await user.type(getEditor()!, 'Bring extra chairs.')
    expect(hasUnsavedRichText()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(hasUnsavedRichText()).toBe(false)
  })

  it('deregisters from the unsaved-content tracker when a dirty field is discarded, not just saved', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    fireEvent.blur(getEditor()!)

    expect(onCommit).not.toHaveBeenCalled()
    expect(getEditor()).toBeInTheDocument()
    expect(getEditor()).toHaveTextContent('Bring extra chairs.')
  })

  it('commits typed content on Save, and returns to the read-only display', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith('<p>Bring extra chairs.</p>')
    await waitFor(() => expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument())
  })

  it('checkpoints on Cmd/Ctrl-S without closing the editor', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Bring extra chairs.')
    fireEvent.keyDown(getEditor()!, { key: 's', ctrlKey: true })

    expect(onCommit).toHaveBeenCalledWith('<p>Bring extra chairs.</p>')
    expect(getEditor()).toBeInTheDocument()
    expect(getEditor()).toHaveTextContent('Bring extra chairs.')
  })

  it('a Cancel after a Cmd/Ctrl-S checkpoint only discards what changed since, closing with no prompt if nothing did', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.type(getEditor()!, 'First item')
    await user.click(screen.getByRole('button', { name: 'List' }))
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
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.click(getEditor()!)
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith(null)
  })

  it('toggles bold from the toolbar, reflected in both the active state and the committed HTML', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.type(getEditor()!, 'Before')
    await user.click(screen.getByRole('button', { name: 'Divider' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommit).toHaveBeenCalledWith('<p>Before</p><hr><p></p>')
  })

  it('does not show the selection bubble menu until text is actually selected', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    expect(screen.queryByRole('toolbar', { name: 'Selection formatting' })).not.toBeInTheDocument()
  })

  it('shows a selection bubble menu with the same mark/heading/list actions once text is selected, but not Divider', async () => {
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={vi.fn()} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(getEditor()!)
    await user.keyboard('{Control>}a{/Control}')

    const bubble = await screen.findByRole('toolbar', { name: 'Selection formatting' })
    expect(within(bubble).getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Underline' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Heading 1' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'Heading 2' })).toBeInTheDocument()
    expect(within(bubble).getByRole('button', { name: 'List' })).toBeInTheDocument()
    // Inserts a new node rather than acting on a selection, so it doesn't
    // belong in a menu that only ever appears because text is selected.
    expect(within(bubble).queryByRole('button', { name: 'Divider' })).not.toBeInTheDocument()
  })

  it('toggles bold from the selection bubble menu, reflected in the committed HTML', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Bring extra chairs.')).toBeInTheDocument()
  })

  it('closes immediately on Escape with no prompt, when nothing was actually changed', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())

    fireEvent.keyDown(getEditor()!, { key: 'Escape' })

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('closes on Escape even while unfocused (scrolled away, say), as long as the field is clean', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value="<p>Bring extra chairs.</p>" onCommit={onCommit} fieldName={FIELD_NAME} />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    ;(getEditor() as HTMLElement).blur()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    await waitFor(() => expect(getEditor()).not.toBeInTheDocument())
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does nothing on an unfocused Escape while the field is dirty - only Cancel/Discard or a focused Escape can close it then', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')
    ;(getEditor() as HTMLElement).blur()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(onCommit).not.toHaveBeenCalled()
    expect(getEditor()).toBeInTheDocument()
    expect(screen.queryByText('Discard your changes?')).not.toBeInTheDocument()
  })

  it('arms a discard prompt on the first Cancel click, without closing or committing', async () => {
    const onCommit = vi.fn()
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
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
    render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

    const user = userEvent.setup()
    await openEditor(user)
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, 'Abandoned edit')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await screen.findByText('Discard your changes?')
    fireEvent.blur(getEditor()!)

    expect(onCommit).not.toHaveBeenCalled()
    expect(getEditor()).toBeInTheDocument()
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
  })

  describe('resume-editing pill', () => {
    it('does not appear for a field that is still on screen, even while dirty', async () => {
      render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

      const user = userEvent.setup()
      await openEditor(user)
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, 'Bring extra chairs.')

      expect(screen.queryByRole('button', { name: 'Resume editing notes' })).not.toBeInTheDocument()
    })

    it('does not appear once scrolled off screen if the field was never actually touched', async () => {
      render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

      const user = userEvent.setup()
      await openEditor(user)
      await waitFor(() => expect(getEditor()).toBeInTheDocument())

      // No observer even exists yet - it's only created once there's
      // something worth watching for.
      expect(getLatestIntersectionObserverCallback()).toBeNull()
      expect(screen.queryByRole('button', { name: 'Resume editing notes' })).not.toBeInTheDocument()
    })

    it('appears once a dirty field scrolls off screen, and disappears again once it scrolls back', async () => {
      render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

      const user = userEvent.setup()
      await openEditor(user)
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, 'Bring extra chairs.')

      simulateIntersection(false)
      expect(screen.getByRole('button', { name: 'Resume editing notes' })).toBeInTheDocument()

      simulateIntersection(true)
      expect(screen.queryByRole('button', { name: 'Resume editing notes' })).not.toBeInTheDocument()
    })

    it('points up when the field scrolled off above the viewport, and down when it scrolled off below', async () => {
      render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)

      const user = userEvent.setup()
      await openEditor(user)
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, 'Bring extra chairs.')

      simulateIntersection(false, -50)
      const pill = screen.getByRole('button', { name: 'Resume editing notes' })
      expect(pill.querySelector('.lucide-arrow-up')).toBeInTheDocument()

      simulateIntersection(false, 900)
      expect(screen.getByRole('button', { name: 'Resume editing notes' }).querySelector('.lucide-arrow-down')).toBeInTheDocument()
    })

    it('scrolls the field back into view when clicked', async () => {
      render(<EditableRichText value={null} onCommit={vi.fn()} fieldName={FIELD_NAME} placeholder="No notes yet" />)
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')

      const user = userEvent.setup()
      await openEditor(user)
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, 'Bring extra chairs.')
      simulateIntersection(false)
      scrollIntoView.mockClear() // drop the desktop scroll-into-view call from opening the field

      await user.click(screen.getByRole('button', { name: 'Resume editing notes' }))

      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
    })

    it('disappears once the field is saved, even if it never scrolled back on screen', async () => {
      const onCommit = vi.fn()
      render(<EditableRichText value={null} onCommit={onCommit} fieldName={FIELD_NAME} placeholder="No notes yet" />)

      const user = userEvent.setup()
      await openEditor(user)
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, 'Bring extra chairs.')
      simulateIntersection(false)
      expect(screen.getByRole('button', { name: 'Resume editing notes' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.queryByRole('button', { name: 'Resume editing notes' })).not.toBeInTheDocument()
    })
  })
})
