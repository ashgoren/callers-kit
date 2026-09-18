import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getDefaultSkeleton } from '@/lib/phraseSkeleton'
import { FiguresList } from './FiguresList'
import type { FigureItem } from '@/lib/figures'

function getEditor() {
  return document.querySelector('[contenteditable="true"]')
}

const contraSkeleton = getDefaultSkeleton('Contra')

describe('FiguresList', () => {
  describe('view mode (isEditing=false) - plain content, nothing interactive', () => {
    it('shows a placeholder when there are no items', () => {
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={null} manualPhrasing={false} isEditing={false} onChange={vi.fn()} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('offers no Add figure/Add note buttons - those are edit-mode only', () => {
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={null} manualPhrasing={false} isEditing={false} onChange={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Add figure' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument()
    })

    it('renders no drag handles or remove buttons', () => {
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing={false}
          onChange={vi.fn()}
        />,
      )

      expect(screen.queryByRole('button', { name: 'Reorder figure' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove figure' })).not.toBeInTheDocument()
    })

    it('renders a figure\'s description as sanitized HTML', () => {
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[
            { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle <strong>left</strong></p><script>window.pwned = true</script>' },
          ]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing={false}
          onChange={vi.fn()}
        />,
      )

      expect(screen.getByText('left').tagName).toBe('STRONG')
      expect(document.querySelector('script')).not.toBeInTheDocument()
    })

    it('renders an interspersed note\'s text as sanitized HTML', () => {
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'n1', kind: 'note', text: '<p>Watch the timing</p><img src="x" onerror="window.pwned = true">' }]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing={false}
          onChange={vi.fn()}
        />,
      )

      expect(screen.getByText('Watch the timing')).toBeInTheDocument()
      const img = document.querySelector('img')
      expect(img).not.toHaveAttribute('onerror')
    })

    it('renders beats parenthesized, and groups figures by phrase with no repeat heading', () => {
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[
            { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' },
            { id: 'f2', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle right' },
            { id: 'f3', kind: 'figure', phrase: 'A2', beats: 8, description: 'Swing' },
          ]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing={false}
          onChange={vi.fn()}
        />,
      )

      expect(screen.getAllByText('A1')).toHaveLength(1)
      expect(screen.getByText('A2')).toBeInTheDocument()
      expect(screen.getAllByText('(8)')).toHaveLength(3)
    })

    it('does not open an editor or call onChange when content is clicked', async () => {
      const onChange = vi.fn()
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing={false}
          onChange={onChange}
        />,
      )

      await userEvent.setup().click(screen.getByText('Circle left'))

      expect(getEditor()).not.toBeInTheDocument()
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('edit mode (isEditing=true) - reorder, add/remove, edit everything', () => {
    it('still shows a placeholder when there are no items, alongside the Add buttons', () => {
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={null} manualPhrasing={false} isEditing onChange={vi.fn()} />)

      expect(screen.getByText('—')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add figure' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument()
    })

    it('commits an edited figure description through onChange, as the whole updated array', async () => {
      const onChange = vi.fn()
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing
          onChange={onChange}
        />,
      )

      const user = userEvent.setup()
      await user.click(screen.getByText('Circle left'))
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, ' fast')
      await user.tab()

      expect(onChange).toHaveBeenCalledWith([
        { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left fast</p>' },
      ])
    })

    it('commits edited note text through onChange, by that note\'s own id', async () => {
      const onChange = vi.fn()
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'n1', kind: 'note', text: '<p>Watch the timing</p>' }]}
          skeleton={null}
          manualPhrasing={false}
          isEditing
          onChange={onChange}
        />,
      )

      const user = userEvent.setup()
      await user.click(screen.getByText('Watch the timing'))
      await waitFor(() => expect(getEditor()).toBeInTheDocument())
      await user.type(getEditor()!, ' here')
      await user.tab()

      expect(onChange).toHaveBeenCalledWith([{ id: 'n1', kind: 'note', text: '<p>Watch the timing here</p>' }])
    })

    it('commits an edited beats count through onChange', async () => {
      const onChange = vi.fn()
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing
          onChange={onChange}
        />,
      )

      const user = userEvent.setup()
      await user.click(screen.getByText('8'))
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '12')
      await user.tab()

      expect(onChange).toHaveBeenCalledWith([{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 12, description: 'Circle left' }])
    })

    it('adds a new figure at the end via the Add figure button', async () => {
      const onChange = vi.fn()
      const items: FigureItem[] = [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 16, description: 'Circle left' }]
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={items} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={onChange} />)

      await userEvent.setup().click(screen.getByRole('button', { name: 'Add figure' }))

      expect(onChange).toHaveBeenCalledTimes(1)
      const result = onChange.mock.calls[0][0] as FigureItem[]
      expect(result).toHaveLength(2)
      // Starts a new phrase span (A2) since f1 already accounts for a full 16-beat A1.
      expect(result[1]).toMatchObject({ kind: 'figure', phrase: 'A2', beats: 16, description: '' })
    })

    it('adds a new note at the end via the Add note button', async () => {
      const onChange = vi.fn()
      const items: FigureItem[] = [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={items} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={onChange} />)

      await userEvent.setup().click(screen.getByRole('button', { name: 'Add note' }))

      const result = onChange.mock.calls[0][0] as FigureItem[]
      expect(result).toHaveLength(2)
      expect(result[1]).toMatchObject({ kind: 'note', text: '' })
    })

    it('removes a figure via its own remove button, by id', async () => {
      const onChange = vi.fn()
      const items: FigureItem[] = [
        { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' },
        { id: 'f2', kind: 'figure', phrase: 'A1', beats: 8, description: 'Swing' },
      ]
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={items} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={onChange} />)

      const removeButtons = screen.getAllByRole('button', { name: 'Remove figure' })
      await userEvent.setup().click(removeButtons[0])

      expect(onChange).toHaveBeenCalledWith([items[1]])
    })

    it('removes a note via its own remove button', async () => {
      const onChange = vi.fn()
      const items: FigureItem[] = [{ id: 'n1', kind: 'note', text: 'Watch the timing' }]
      render(<FiguresList onToggleManualPhrasing={vi.fn()} items={items} skeleton={null} manualPhrasing={false} isEditing onChange={onChange} />)

      await userEvent.setup().click(screen.getByRole('button', { name: 'Remove note' }))

      expect(onChange).toHaveBeenCalledWith([])
    })

    it('groups figures by their live-computed phrase, not each one\'s own stored (and here, deliberately wrong) phrase field', () => {
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[
            { id: 'f1', kind: 'figure', phrase: 'wrong-on-purpose', beats: 16, description: 'Circle left' },
            { id: 'f2', kind: 'figure', phrase: 'also-wrong', beats: 16, description: 'Swing' },
            { id: 'n1', kind: 'note', text: 'Watch the timing' },
            { id: 'f3', kind: 'figure', phrase: 'nope', beats: 16, description: 'Balance' },
          ]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing
          onChange={vi.fn()}
        />,
      )

      expect(screen.getByText('A1')).toBeInTheDocument()
      // A2 shows once even though two figures (f2, f3) share it - the note between them doesn't break the grouping.
      expect(screen.getAllByText('A2')).toHaveLength(1)
      expect(screen.queryByText('wrong-on-purpose')).not.toBeInTheDocument()
    })

    it('renders phrase as a plain, non-editable label when a skeleton is computing it live', async () => {
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing
          onChange={vi.fn()}
        />,
      )

      await userEvent.setup().click(screen.getByText('A1'))

      // Clicking it doesn't open an editable field.
      expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    })

    it('renders phrase as an editable field, committing through onChange, once manualPhrasing is on', async () => {
      const onChange = vi.fn()
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]}
          skeleton={contraSkeleton}
          manualPhrasing
          isEditing
          onChange={onChange}
        />,
      )

      const user = userEvent.setup()
      await user.click(screen.getByText('A1'))
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'Verse')
      await user.tab()

      expect(onChange).toHaveBeenCalledWith([{ id: 'f1', kind: 'figure', phrase: 'Verse', beats: 8, description: 'Circle left' }])
    })

    it('renders phrase as editable even with manualPhrasing off, when the dance type has no default skeleton at all', async () => {
      // A version's manual_phrasing column defaults to false for every dance
      // type, including ones with no default skeleton (Square/ECD/Mixer/
      // Other) - phrase still has to be editable there, since the toggle to
      // flip it to "manual" is never even shown for those dance types.
      render(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={[{ id: 'f1', kind: 'figure', phrase: 'Opener', beats: 8, description: 'Circle left' }]}
          skeleton={null}
          manualPhrasing={false}
          isEditing
          onChange={vi.fn()}
        />,
      )

      await userEvent.setup().click(screen.getByText('Opener'))

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('shows the Manual phrasing switch only when a skeleton exists to toggle away from', () => {
      const { rerender } = render(
        <FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={vi.fn()} />,
      )
      expect(screen.getByRole('switch', { name: 'Manual phrasing' })).toBeInTheDocument()

      rerender(<FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={null} manualPhrasing={false} isEditing onChange={vi.fn()} />)
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })

    it('hides the Manual phrasing switch in view mode, even with a skeleton', () => {
      render(
        <FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={contraSkeleton} manualPhrasing={false} isEditing={false} onChange={vi.fn()} />,
      )

      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })

    it('toggles manual phrasing through onToggleManualPhrasing, reflecting the current value', async () => {
      const onToggleManualPhrasing = vi.fn()
      render(
        <FiguresList
          onToggleManualPhrasing={onToggleManualPhrasing}
          items={[]}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing
          onChange={vi.fn()}
        />,
      )

      const toggle = screen.getByRole('switch', { name: 'Manual phrasing' })
      expect(toggle).not.toBeChecked()

      await userEvent.setup().click(toggle)

      expect(onToggleManualPhrasing).toHaveBeenCalledWith(true, expect.anything())
    })

    it('shows a mutation immediately, bridging the gap before the items prop catches up with the commit', async () => {
      // onChange here never actually updates `items` (mirroring the real
      // async gap between a commit and the reactive query noticing it) -
      // this is what a rendered mutation would look like stuck mid-flight.
      const items: FigureItem[] = [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' }]
      const onChange = vi.fn()
      const { rerender } = render(
        <FiguresList onToggleManualPhrasing={vi.fn()} items={items} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={onChange} />,
      )

      await userEvent.setup().click(screen.getByRole('button', { name: 'Add figure' }))

      expect(screen.getAllByRole('button', { name: 'Remove figure' })).toHaveLength(2)

      // A re-render with the same still-stale prop (the commit still in
      // flight) keeps showing the optimistic result rather than reverting.
      rerender(
        <FiguresList onToggleManualPhrasing={vi.fn()} items={items} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={onChange} />,
      )
      expect(screen.getAllByRole('button', { name: 'Remove figure' })).toHaveLength(2)

      // Once the real items prop actually catches up (matches what onChange
      // was called with), the override clears - proven here by then passing
      // a third, different items array and confirming the render reflects
      // that instead of a stale optimistic cache.
      const committedItems = onChange.mock.calls[0][0] as FigureItem[]
      rerender(
        <FiguresList
          onToggleManualPhrasing={vi.fn()}
          items={committedItems}
          skeleton={contraSkeleton}
          manualPhrasing={false}
          isEditing
          onChange={onChange}
        />,
      )
      rerender(
        <FiguresList onToggleManualPhrasing={vi.fn()} items={[]} skeleton={contraSkeleton} manualPhrasing={false} isEditing onChange={onChange} />,
      )
      expect(screen.queryAllByRole('button', { name: 'Remove figure' })).toHaveLength(0)
    })
  })
})
