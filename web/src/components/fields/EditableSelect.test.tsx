import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditableSelect } from './EditableSelect'

describe('EditableSelect', () => {
  it('renders the value as plain text, not yet as a select', () => {
    render(<EditableSelect value="Contra" onCommit={vi.fn()} options={['Contra', 'Square']} />)

    expect(screen.getByText('Contra')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows a muted placeholder in the plain-text display when the value is null', () => {
    render(<EditableSelect value={null} onCommit={vi.fn()} options={['Contra', 'Square']} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('opens the picker immediately once clicked, rather than requiring a second click to open it', async () => {
    render(<EditableSelect value="Contra" onCommit={vi.fn()} options={['Contra', 'Square']} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Contra'))

    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Square' })).toBeInTheDocument()
  })

  it('commits the picked option immediately, and returns to plain-text display', async () => {
    const onCommit = vi.fn()
    render(<EditableSelect value="Contra" onCommit={onCommit} options={['Contra', 'Square']} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Contra'))
    await user.click(await screen.findByRole('option', { name: 'Square' }))

    expect(onCommit).toHaveBeenCalledWith('Square')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('Square')).toBeInTheDocument()
  })

  it('closes without committing when dismissed via Escape, rather than picking anything', async () => {
    const onCommit = vi.fn()
    render(<EditableSelect value="Contra" onCommit={onCommit} options={['Contra', 'Square']} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Contra'))
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Contra')).toBeInTheDocument()
  })

  it('formats both the closed display and each option through formatLabel, while committing the raw underlying value', async () => {
    const onCommit = vi.fn()
    const formatLabel = (value: string) => value.replace(/^Duple Minor - /, '')
    render(
      <EditableSelect
        value="Duple Minor - Becket"
        onCommit={onCommit}
        options={['Duple Minor - Becket', 'Duple Minor - Improper']}
        formatLabel={formatLabel}
      />,
    )

    expect(screen.getByText('Becket')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByText('Becket'))
    await user.click(await screen.findByRole('option', { name: 'Improper' }))

    expect(onCommit).toHaveBeenCalledWith('Duple Minor - Improper')
    expect(screen.getByText('Improper')).toBeInTheDocument()
  })
})
