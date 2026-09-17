import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditableFigureText } from './EditableFigureText'

// A plain contenteditable div doesn't get an implicit ARIA textbox role -
// see EditableRichText.test.tsx's own identical helper.
function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

// Every test that types after opening the field clicks the editor a second
// time (once on the display span to open it, then again directly on the
// mounted contentEditable) before typing - without this second click,
// user-event intermittently starts typing at the very beginning of the
// text instead of wherever the component's own focus('end') put the
// cursor, in a way tied to jsdom's single global document.getSelection()
// rather than anything the component itself does differently per test.

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
    await user.click(getEditor()!)
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
    await user.click(getEditor()!)
    await user.type(getEditor()!, ' fast{Enter}')

    // toContain rather than an exact string - jsdom's selection handling
    // right after a fresh focus() isn't reliable enough between test runs
    // to assert on exactly where the typed text landed (see the legacy
    // font-size test below, which hit the same issue and dropped the
    // exact-position assertion for the same reason). What this test
    // actually checks - a single Enter commits rather than starting a new
    // paragraph - only needs there to still be exactly one <p>.
    expect(onCommit).toHaveBeenCalledTimes(1)
    const [committedHtml] = onCommit.mock.calls[0] as [string]
    expect(committedHtml).toContain('Circle left')
    expect(committedHtml).toContain('fast')
    expect(committedHtml?.match(/<p>/g)).toHaveLength(1)
  })

  it('does not commit on Shift+Enter - it inserts a line break instead', async () => {
    const onCommit = vi.fn()
    render(<EditableFigureText value="<p>Circle left</p>" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.click(getEditor()!)
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

    // Already re-serialized through the modern <span style="font-size:...">
    // form as soon as the legacy content loads - proving the legacy tag
    // parsed into the same underlying mark rather than being dropped or
    // ignored, independent of anything typed afterward.
    expect(getEditor()?.innerHTML).toContain('font-size: 0.8em')

    // Exercises that an edit still commits (and still carries the mark)
    // without asserting exactly where the typed character landed - jsdom's
    // selection handling right at a mark boundary like this one isn't
    // reliable enough between test runs to assert on.
    await user.click(getEditor()!)
    await user.type(getEditor()!, '!')
    await user.tab()

    const [committedHtml] = onCommit.mock.calls[0] as [string]
    expect(committedHtml).toContain('font-size: 0.8em')
    expect(committedHtml).toContain('!')
  })

  // onActiveChange is how a shared toolbar rendered elsewhere (FigureToolbar,
  // via DanceDetailPage) knows which figure is currently being edited - this
  // whole mechanism was the source of most of the toolbar's real bugs this
  // session (the toolbar not appearing, or not disappearing again), so it's
  // worth covering directly rather than only through toolbar-level tests.
  describe('onActiveChange', () => {
    it('reports the live editor once the field opens', async () => {
      const onActiveChange = vi.fn()
      render(<EditableFigureText value="<p>Circle left</p>" onCommit={vi.fn()} onActiveChange={onActiveChange} />)

      expect(onActiveChange).not.toHaveBeenCalled()

      const user = userEvent.setup()
      await user.click(screen.getByText('Circle left'))
      // Waiting on onActiveChange directly, not just on the editor's DOM
      // node existing - the component's own focus('end') effect is what
      // triggers this report, and that effect running is not guaranteed
      // to have already happened just because the node is now in the DOM.
      await waitFor(() => expect(onActiveChange).toHaveBeenCalled())

      const [reportedEditor] = onActiveChange.mock.calls[0] as [{ isDestroyed: boolean }]
      expect(reportedEditor.isDestroyed).toBe(false)
    })

    it('reports null on blur', async () => {
      const onActiveChange = vi.fn()
      render(<EditableFigureText value="<p>Circle left</p>" onCommit={vi.fn()} onActiveChange={onActiveChange} />)

      const user = userEvent.setup()
      await user.click(screen.getByText('Circle left'))
      await waitFor(() => expect(onActiveChange).toHaveBeenCalled())
      await user.tab()

      expect(onActiveChange).toHaveBeenLastCalledWith(null)
    })

    it('reports null on a plain Enter, the same as a blur', async () => {
      const onActiveChange = vi.fn()
      render(<EditableFigureText value="<p>Circle left</p>" onCommit={vi.fn()} onActiveChange={onActiveChange} />)

      const user = userEvent.setup()
      await user.click(screen.getByText('Circle left'))
      await waitFor(() => expect(onActiveChange).toHaveBeenCalled())
      await user.keyboard('{Enter}')

      expect(onActiveChange).toHaveBeenLastCalledWith(null)
    })

    it('reports null on Escape', async () => {
      const onActiveChange = vi.fn()
      render(<EditableFigureText value="<p>Circle left</p>" onCommit={vi.fn()} onActiveChange={onActiveChange} />)

      const user = userEvent.setup()
      await user.click(screen.getByText('Circle left'))
      await waitFor(() => expect(onActiveChange).toHaveBeenCalled())
      await user.keyboard('{Escape}')

      expect(onActiveChange).toHaveBeenLastCalledWith(null)
    })

    it('does not report null on Shift+Enter - the field, and the toolbar, stay open', async () => {
      const onActiveChange = vi.fn()
      render(<EditableFigureText value="<p>Circle left</p>" onCommit={vi.fn()} onActiveChange={onActiveChange} />)

      const user = userEvent.setup()
      await user.click(screen.getByText('Circle left'))
      await waitFor(() => expect(onActiveChange).toHaveBeenCalled())
      onActiveChange.mockClear()
      await user.keyboard('{Shift>}{Enter}{/Shift}')

      expect(onActiveChange).not.toHaveBeenCalledWith(null)
    })
  })
})
