import { EditorContent, useEditor } from '@tiptap/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COMPACT_TEXT_EXTENSIONS } from '@/components/fields/compactTextExtensions'
import { FigureToolbar } from './FigureToolbar'

// FigureToolbar operates on a live editor instance passed in as a prop,
// rather than creating one itself - this harness mirrors how
// DanceDetailPage actually wires it up (the toolbar and the figure's own
// EditorContent are siblings, not parent/child), close enough for testing
// the toolbar's own behavior without the rest of the figures list around it.
function TestHarness({ content = '<p></p>' }: { content?: string }) {
  const editor = useEditor({ extensions: COMPACT_TEXT_EXTENSIONS, content })
  if (!editor) return null

  return (
    <div>
      <FigureToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function getEditor() {
  return document.querySelector('[contenteditable="true"]')!
}

describe('FigureToolbar', () => {
  it('renders bold, italic, underline, and the three font sizes', () => {
    render(<TestHarness />)

    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Small text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Normal text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Large text' })).toBeInTheDocument()
  })

  it('toggles bold active state on click, without moving focus off the editor', async () => {
    render(<TestHarness />)

    const user = userEvent.setup()
    await user.click(getEditor())

    const boldButton = screen.getByRole('button', { name: 'Bold' })
    expect(boldButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(boldButton)

    expect(boldButton).toHaveAttribute('aria-pressed', 'true')
    // The whole point of every button here using ToolbarButton's
    // onMouseDown-preventDefault handling is that clicking it never
    // actually takes focus away from the figure being edited - that's
    // what lets EditableFigureText and DanceDetailPage stay free of any
    // toolbar-blur coordination logic at all.
    expect(document.activeElement).toBe(getEditor())
  })

  it('applies bold to subsequently typed text', async () => {
    render(<TestHarness />)

    const user = userEvent.setup()
    await user.click(getEditor())
    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await user.type(getEditor(), 'hi')

    expect(getEditor().innerHTML).toContain('<strong>hi</strong>')
  })

  it('only one font size is active at a time, and applies to subsequently typed text', async () => {
    render(<TestHarness />)

    const user = userEvent.setup()
    await user.click(getEditor())

    const smallButton = screen.getByRole('button', { name: 'Small text' })
    const normalButton = screen.getByRole('button', { name: 'Normal text' })
    const largeButton = screen.getByRole('button', { name: 'Large text' })

    // No font-size mark at all means the content already is Normal size,
    // so Normal (not neither) starts out active.
    expect(normalButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(largeButton)
    expect(largeButton).toHaveAttribute('aria-pressed', 'true')
    expect(smallButton).toHaveAttribute('aria-pressed', 'false')
    expect(normalButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(smallButton)
    expect(smallButton).toHaveAttribute('aria-pressed', 'true')
    expect(largeButton).toHaveAttribute('aria-pressed', 'false')

    await user.type(getEditor(), 'hi')
    expect(getEditor().innerHTML).toContain('font-size: 0.8em')
  })

  it('unsets the font size mark when Normal is clicked', async () => {
    render(<TestHarness />)

    const user = userEvent.setup()
    await user.click(getEditor())
    await user.click(screen.getByRole('button', { name: 'Large text' }))
    await user.click(screen.getByRole('button', { name: 'Normal text' }))

    expect(screen.getByRole('button', { name: 'Normal text' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Large text' })).toHaveAttribute('aria-pressed', 'false')

    await user.type(getEditor(), 'hi')
    expect(getEditor().innerHTML).not.toContain('font-size')
  })
})
