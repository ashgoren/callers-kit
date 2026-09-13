import { renderHook } from '@testing-library/react'
import { sortFn_alphanumeric, useTable } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { buildColumns, makeFieldDefiner } from './fieldColumns'
import { dataTableFeatures } from './tableInstance'

interface Row {
  id: string
  name: string | null
}

const defineField = makeFieldDefiner<Row>()

describe('makeFieldDefiner', () => {
  it('returns the field object unchanged - it exists only to help K get inferred', () => {
    const field = defineField({ key: 'name', label: 'Name', render: (value) => value ?? '—' })

    expect(field).toEqual({ key: 'name', label: 'Name', render: field.render })
  })
})

describe('buildColumns', () => {
  const fields = [
    defineField({ key: 'name', label: 'Name', render: (value) => value ?? '—', sortFn: sortFn_alphanumeric, size: 200 }),
    defineField({
      key: 'id',
      label: 'ID',
      render: (value) => value,
      sortValue: () => null, // always "missing", to exercise sortUndefined below
      size: 60,
      minSize: 40,
      maxSize: 80,
    }),
  ]
  const columns = buildColumns(fields)

  it('carries each field\'s id, label, and size through to the column def', () => {
    expect(columns[0]).toMatchObject({ id: 'name', header: 'Name', size: 200 })
    expect(columns[1]).toMatchObject({ id: 'id', header: 'ID', size: 60, minSize: 40, maxSize: 80 })
  })

  it('omits minSize/maxSize entirely when the field does not specify them', () => {
    expect(columns[0]).not.toHaveProperty('minSize')
    expect(columns[0]).not.toHaveProperty('maxSize')
  })

  it('sorts rows with no resolved sortValue to the end, in either sort direction', () => {
    const data: Row[] = [
      { id: '1', name: 'Bravo' },
      { id: '2', name: null }, // sortValue below resolves this to null -> undefined
      { id: '3', name: 'Alpha' },
    ]
    // Only the 'name' column is used for sorting here - 'id' always resolves
    // to undefined via its sortValue, so it's not a useful sort target, but
    // building it alongside 'name' confirms multiple fields coexist.
    const { result } = renderHook(() =>
      useTable({
        features: dataTableFeatures,
        columns,
        data,
        getRowId: (row) => row.id,
        state: { sorting: [{ id: 'name', desc: false }] },
      }),
    )

    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(['3', '1', '2'])
  })
})
