import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldList } from './FieldList'
import type { DetailField } from './DetailField'

interface Row {
  id: string
  name: string
}

describe('FieldList', () => {
  it('renders each field\'s label and its render output', () => {
    const fields: DetailField<Row>[] = [{ key: 'name', label: 'Name', render: (value) => value }]
    render(<FieldList fields={fields} row={{ id: '1', name: 'Chorus Jig' }} />)

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Chorus Jig')).toBeInTheDocument()
  })

  it('passes the whole row to render, not just the field\'s own value - e.g. so a field can commit through the row\'s own id', () => {
    const fields: DetailField<Row>[] = [{ key: 'name', label: 'Name', render: (value, row) => `${value} (${row.id})` }]
    render(<FieldList fields={fields} row={{ id: '42', name: 'Chorus Jig' }} />)

    expect(screen.getByText('Chorus Jig (42)')).toBeInTheDocument()
  })
})
