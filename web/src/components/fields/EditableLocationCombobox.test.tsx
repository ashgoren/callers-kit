import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditableLocationCombobox } from './EditableLocationCombobox'

const { useLocationsMock, createLocationMock } = vi.hoisted(() => ({
  useLocationsMock: vi.fn(),
  createLocationMock: vi.fn(),
}))

vi.mock('@/lib/powersync/useLocations', () => ({
  useLocations: useLocationsMock,
  createLocation: createLocationMock,
}))

const LOCATIONS = [
  { id: 'loc-1', name: 'Grange Hall' },
  { id: 'loc-2', name: 'Town Hall' },
]

describe('EditableLocationCombobox', () => {
  beforeEach(() => {
    useLocationsMock.mockReturnValue({ locations: LOCATIONS, isLoading: false })
    createLocationMock.mockReset()
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
    createLocationMock.mockResolvedValue('loc-new')
    render(<EditableLocationCombobox value={null} onCommit={onCommit} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('—'))
    await user.type(await screen.findByRole('combobox'), 'Fire Hall')
    await user.click(await screen.findByRole('option', { name: /Create "Fire Hall"/ }))

    expect(createLocationMock).toHaveBeenCalledWith('Fire Hall')
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
