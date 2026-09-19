import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditableLocationCombobox } from './EditableLocationCombobox'

const { useOwnerTableOptionsMock, createOwnerTableOptionMock } = vi.hoisted(() => ({
  useOwnerTableOptionsMock: vi.fn(),
  createOwnerTableOptionMock: vi.fn(),
}))

vi.mock('@/lib/powersync/useOwnerTableOptions', () => ({
  useOwnerTableOptions: useOwnerTableOptionsMock,
  createOwnerTableOption: createOwnerTableOptionMock,
}))

const LOCATIONS = [
  { id: 'loc-1', name: 'Grange Hall' },
  { id: 'loc-2', name: 'Town Hall' },
]

describe('EditableLocationCombobox', () => {
  beforeEach(() => {
    useOwnerTableOptionsMock.mockReturnValue({ options: LOCATIONS, isLoading: false })
    createOwnerTableOptionMock.mockReset()
  })

  it("renders the current selection's name as plain text, not yet as a combobox", () => {
    render(<EditableLocationCombobox value="loc-1" onCommit={vi.fn()} />)

    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows a muted placeholder in the plain-text display when the value is null', () => {
    render(<EditableLocationCombobox value={null} onCommit={vi.fn()} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('opens immediately once clicked, listing every existing location, with the search input already focused', async () => {
    render(<EditableLocationCombobox value="loc-1" onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Grange Hall'))

    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Town Hall' })).toBeInTheDocument()
    // Typing has to work immediately, with no extra click into the input
    // first - matching every other Editable* field's autoFocus convention.
    expect(screen.getByRole('combobox')).toHaveFocus()
  })

  it("shows the current selection's name as the search box's placeholder, not the generic instructional one", async () => {
    // Real text (not just the generic placeholder) would also feed the
    // dropdown's own filtering, narrowing the just-opened list down to only
    // this one match - a placeholder shows it without that side effect,
    // confirmed below by Town Hall still being a selectable option.
    render(<EditableLocationCombobox value="loc-1" onCommit={vi.fn()} />)

    await userEvent.setup().click(screen.getByText('Grange Hall'))

    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('placeholder', 'Grange Hall')
    expect(input).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Town Hall' })).toBeInTheDocument()
  })

  it('falls back to the generic instructional placeholder when nothing is selected yet', async () => {
    render(<EditableLocationCombobox value={null} onCommit={vi.fn()} />)

    await userEvent.setup().click(screen.getByText('—'))

    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Choose or create a location')
  })

  it('commits an existing location immediately, and returns to plain-text display', async () => {
    const onCommit = vi.fn()
    render(<EditableLocationCombobox value="loc-1" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Grange Hall'))
    await user.click(await screen.findByRole('option', { name: 'Town Hall' }))

    expect(onCommit).toHaveBeenCalledWith('loc-2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('Town Hall')).toBeInTheDocument()
  })

  it('offers a "Create" option once the typed name matches no existing location', async () => {
    render(<EditableLocationCombobox value={null} onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Fire Hall')

    expect(await screen.findByRole('option', { name: /Create "Fire Hall"/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Grange Hall' })).not.toBeInTheDocument()
  })

  it('does not offer "Create" once the typed name exactly matches an existing location', async () => {
    render(<EditableLocationCombobox value={null} onCommit={vi.fn()} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Grange Hall')

    expect(await screen.findByRole('option', { name: 'Grange Hall' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument()
  })

  it('creates a new location and commits its id when "Create" is picked', async () => {
    const onCommit = vi.fn()
    createOwnerTableOptionMock.mockResolvedValue('loc-new')
    render(<EditableLocationCombobox value={null} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Fire Hall')
    await user.click(await screen.findByRole('option', { name: /Create "Fire Hall"/ }))

    expect(createOwnerTableOptionMock).toHaveBeenCalledWith('locations', 'Fire Hall')
    expect(onCommit).toHaveBeenCalledWith('loc-new')
  })

  it('commits the exact (case-insensitive) match on Enter, without needing to pick it from the list', async () => {
    const onCommit = vi.fn()
    render(<EditableLocationCombobox value={null} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'grange hall{Enter}')

    expect(onCommit).toHaveBeenCalledWith('loc-1')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
  })

  it('does not commit anything on Enter when the typed text only partially matches', async () => {
    const onCommit = vi.fn()
    render(<EditableLocationCombobox value={null} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Gr{Enter}')

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not create or commit anything on Enter when the typed text matches no location at all, starting from a real value', async () => {
    const onCommit = vi.fn()
    render(<EditableLocationCombobox value="loc-1" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Grange Hall'))
    await user.type(await screen.findByRole('combobox'), 'Fire Hall{Enter}')

    // A bare Enter with nothing explicitly highlighted must never silently
    // confirm the "Create" entry - only an explicit pick (click, or
    // arrow-navigate then Enter - see the test below) creates anything.
    expect(createOwnerTableOptionMock).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
  })

  it('still creates and commits via Enter when the "Create" entry was explicitly arrow-key-highlighted first', async () => {
    const onCommit = vi.fn()
    createOwnerTableOptionMock.mockResolvedValue('loc-new')
    render(<EditableLocationCombobox value={null} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Fire Hall')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(createOwnerTableOptionMock).toHaveBeenCalledWith('locations', 'Fire Hall')
    expect(onCommit).toHaveBeenCalledWith('loc-new')
  })

  it('closes without committing when dismissed via Escape, rather than picking anything', async () => {
    const onCommit = vi.fn()
    render(<EditableLocationCombobox value="loc-1" onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Grange Hall'))
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Grange Hall')).toBeInTheDocument()
  })
})
