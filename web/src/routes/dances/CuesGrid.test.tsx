import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CuesGrid } from './CuesGrid'
import type { CuesData } from '@/lib/cues'

function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

describe('CuesGrid', () => {
  it('renders a populated cell as sanitized HTML', () => {
    const cues: CuesData = { cells: { 'A1:0:0': '<p>Circle <strong>left</strong></p>' } }
    render(<CuesGrid cues={cues} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    expect(screen.getByText('left').tagName).toBe('STRONG')
  })

  it('strips unsafe markup from a cell before rendering it', () => {
    const cues: CuesData = { cells: { 'A1:0:0': '<p>Circle left</p><script>window.pwned = true</script>' } }
    render(<CuesGrid cues={cues} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    expect(screen.getByText('Circle left')).toBeInTheDocument()
    expect(document.querySelector('script')).not.toBeInTheDocument()
  })

  it('shows the section labels', () => {
    render(<CuesGrid cues={null} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.getByText('B2')).toBeInTheDocument()
  })

  it('does not show a toolbar until a cell is being edited', () => {
    render(<CuesGrid cues={null} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('commits an edited cell through onEditCell, keyed by that cell\'s own key', async () => {
    const onEditCell = vi.fn()
    const cues: CuesData = { cells: { 'A1:0:0': '<p>Circle left</p>' } }
    render(<CuesGrid cues={cues} onEditCell={onEditCell} onToggleSeparator={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await waitFor(() => expect(getEditor()).toBeInTheDocument())
    await user.type(getEditor()!, ' fast')
    await user.tab()

    expect(onEditCell).toHaveBeenCalledWith('A1:0:0', '<p>Circle left fast</p>')
  })

  it('shows a shared toolbar reflecting the currently-focused cell\'s formatting', async () => {
    const cues: CuesData = { cells: { 'A1:0:0': '<p><strong>Swing</strong></p>' } }
    render(<CuesGrid cues={cues} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Swing'))
    // Waiting on the toolbar directly, not just the editor's DOM node
    // existing - the field's own focus('end') effect (which is what
    // actually reports the active editor up to this toolbar) isn't
    // guaranteed to have already run just because the node is in the DOM.
    const toolbar = await screen.findByRole('toolbar')
    expect(within(toolbar).getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles a separator on the currently-focused cell through onToggleSeparator', async () => {
    const onToggleSeparator = vi.fn()
    const cues: CuesData = { cells: { 'A1:0:0': '<p>Circle left</p>' } }
    render(<CuesGrid cues={cues} onEditCell={vi.fn()} onToggleSeparator={onToggleSeparator} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await screen.findByRole('toolbar')
    await user.click(screen.getByRole('button', { name: 'Add separator' }))

    expect(onToggleSeparator).toHaveBeenCalledWith('A1:0:0')
  })

  it('reflects an existing separator as already active in the toolbar', async () => {
    const cues: CuesData = { cells: { 'A1:0:0': '<p>Circle left</p>' }, separators: ['A1:0:0'] }
    render(<CuesGrid cues={cues} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await screen.findByRole('toolbar')

    expect(screen.getByRole('button', { name: 'Remove separator' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides the toolbar again once editing ends', async () => {
    const cues: CuesData = { cells: { 'A1:0:0': '<p>Circle left</p>' } }
    render(<CuesGrid cues={cues} onEditCell={vi.fn()} onToggleSeparator={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Circle left'))
    await screen.findByRole('toolbar')
    await user.tab()

    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument())
  })
})
