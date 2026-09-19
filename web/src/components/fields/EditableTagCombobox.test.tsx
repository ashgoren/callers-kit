import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditableTagCombobox } from './EditableTagCombobox'

const { useOwnerTableOptionsMock, createOwnerTableOptionMock, commitRelationEditMock } = vi.hoisted(() => ({
  useOwnerTableOptionsMock: vi.fn(),
  createOwnerTableOptionMock: vi.fn(),
  commitRelationEditMock: vi.fn(),
}))

vi.mock('@/lib/powersync/useOwnerTableOptions', () => ({
  useOwnerTableOptions: useOwnerTableOptionsMock,
  createOwnerTableOption: createOwnerTableOptionMock,
}))

vi.mock('@/lib/powersync/commitRelationEdit', () => ({
  commitRelationEdit: commitRelationEditMock,
}))

const KEY_MOVES = [
  { id: 'km-1', name: 'Allemande' },
  { id: 'km-2', name: 'Swing' },
]

// The dropdown list also shows an attached tag (with a checkmark), so
// getByText('Swing') alone is ambiguous once the field is open - this
// scopes to the chip specifically, which renders before the popup content.
function getChip(name: string): HTMLElement {
  const chip = screen.getAllByText(name)[0]?.closest('[data-slot="combobox-chip"]')
  if (!chip) throw new Error(`No chip found for "${name}"`)
  return chip as HTMLElement
}

const relationArgs = () => ({
  danceId: 'dance-1',
  junctionTable: 'dances_key_moves',
  refIdColumn: 'key_move_id',
  ownerTable: 'key_moves' as const,
})

describe('EditableTagCombobox', () => {
  beforeEach(() => {
    useOwnerTableOptionsMock.mockReturnValue({ options: KEY_MOVES, isLoading: false })
    createOwnerTableOptionMock.mockReset()
    commitRelationEditMock.mockReset()
  })

  it('renders attached tags as chip badges in plain-text display, not yet as a combobox', () => {
    render(<EditableTagCombobox {...relationArgs()} value={[{ id: 'km-2', name: 'Swing' }]} />)

    expect(screen.getByText('Swing')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows a muted placeholder in the plain-text display when nothing is attached', () => {
    render(<EditableTagCombobox {...relationArgs()} value={[]} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('supports a custom display renderer, for a field that shows attached tags as prose instead of chips', () => {
    render(
      <EditableTagCombobox
        {...relationArgs()}
        value={[{ id: 'km-1', name: 'Allemande' }]}
        renderDisplay={(attached) => `by ${attached.map((tag) => tag.name).join(', ')}`}
      />,
    )

    expect(screen.getByText('by Allemande')).toBeInTheDocument()
  })

  it('shows the placeholder text only when the field has no tags attached yet', async () => {
    const user = userEvent.setup()

    const empty = render(<EditableTagCombobox {...relationArgs()} value={[]} placeholder="Add a key move..." />)
    await user.click(screen.getByText('—'))
    expect(screen.getByPlaceholderText('Add a key move...')).toBeInTheDocument()
    empty.unmount()

    render(
      <EditableTagCombobox
        {...relationArgs()}
        value={[{ id: 'km-1', name: 'Allemande' }]}
        placeholder="Add a key move..."
      />,
    )
    await user.click(screen.getByText('Allemande'))
    expect(screen.queryByPlaceholderText('Add a key move...')).not.toBeInTheDocument()
  })

  it('opens immediately once clicked, listing every existing option, with the input already focused', async () => {
    render(<EditableTagCombobox {...relationArgs()} value={[{ id: 'km-1', name: 'Allemande' }]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Allemande'))

    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Swing' })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveFocus()
  })

  it('attaches an existing tag when picked, and closes back to plain-text display', async () => {
    render(<EditableTagCombobox {...relationArgs()} value={[]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.click(await screen.findByRole('option', { name: 'Swing' }))

    expect(commitRelationEditMock).toHaveBeenCalledWith('dances_key_moves', 'key_move_id', 'dance-1', 'km-2', 'add')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('creates a new tag and attaches it when "Create" is picked', async () => {
    createOwnerTableOptionMock.mockResolvedValue('km-new')
    render(<EditableTagCombobox {...relationArgs()} value={[]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Balance')
    await user.click(await screen.findByRole('option', { name: /Create "Balance"/ }))

    expect(createOwnerTableOptionMock).toHaveBeenCalledWith('key_moves', 'Balance')
    expect(commitRelationEditMock).toHaveBeenCalledWith('dances_key_moves', 'key_move_id', 'dance-1', 'km-new', 'add')
  })

  it('attaches the exact (case-insensitive) match on Enter, without needing to pick it from the list', async () => {
    render(<EditableTagCombobox {...relationArgs()} value={[]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'swing{Enter}')

    expect(commitRelationEditMock).toHaveBeenCalledWith('dances_key_moves', 'key_move_id', 'dance-1', 'km-2', 'add')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not attach or create anything on Enter when the typed text matches nothing, and stays open', async () => {
    render(<EditableTagCombobox {...relationArgs()} value={[]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'zzz-no-match{Enter}')

    expect(commitRelationEditMock).not.toHaveBeenCalled()
    expect(createOwnerTableOptionMock).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('removing a tag via its chip closes the field when at least one tag remains attached', async () => {
    render(
      <EditableTagCombobox
        {...relationArgs()}
        value={[
          { id: 'km-1', name: 'Allemande' },
          { id: 'km-2', name: 'Swing' },
        ]}
      />,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('Allemande'))
    await user.click(within(getChip('Allemande')).getByRole('button', { hidden: true }))

    expect(commitRelationEditMock).toHaveBeenCalledWith('dances_key_moves', 'key_move_id', 'dance-1', 'km-1', 'remove')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('removing the last remaining tag leaves the field open, ready to pick a replacement', async () => {
    render(<EditableTagCombobox {...relationArgs()} value={[{ id: 'km-1', name: 'Allemande' }]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Allemande'))
    await user.click(within(getChip('Allemande')).getByRole('button', { hidden: true }))

    expect(commitRelationEditMock).toHaveBeenCalledWith('dances_key_moves', 'key_move_id', 'dance-1', 'km-1', 'remove')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('closes without committing when dismissed via Escape, rather than attaching or clearing anything', async () => {
    render(<EditableTagCombobox {...relationArgs()} value={[{ id: 'km-1', name: 'Allemande' }]} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Allemande'))
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')

    expect(commitRelationEditMock).not.toHaveBeenCalled()
    expect(screen.getByText('Allemande')).toBeInTheDocument()
  })
})
