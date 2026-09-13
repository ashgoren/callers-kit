import { describe, expect, it } from 'vitest'
import { makeDetailFieldDefiner } from './DetailField'

interface Row {
  id: string
  name: string | null
}

const defineField = makeDetailFieldDefiner<Row>()

describe('makeDetailFieldDefiner', () => {
  it('returns the field object unchanged - it exists only to help K get inferred', () => {
    const field = defineField({ key: 'name', label: 'Name', render: (value) => value ?? '—' })

    expect(field).toEqual({ key: 'name', label: 'Name', render: field.render })
  })
})
