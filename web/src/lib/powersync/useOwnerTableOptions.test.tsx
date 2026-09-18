import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './database' // Actually loads the mock below, not the real module.
import { createOwnerTableOption, useOwnerTableOptions } from './useOwnerTableOptions'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

vi.mock('./database', () => ({
  db: { execute: vi.fn() },
}))

describe('useOwnerTableOptions', () => {
  it('queries the given table, alphabetically by name', () => {
    useQueryMock.mockReturnValue({
      data: [
        { id: 'loc-1', name: 'Grange Hall' },
        { id: 'loc-2', name: 'Town Hall' },
      ],
      isLoading: false,
    })

    const { result } = renderHook(() => useOwnerTableOptions('locations'))

    expect(useQueryMock).toHaveBeenCalledWith('SELECT id, name FROM locations ORDER BY name')
    expect(result.current.options).toEqual([
      { id: 'loc-1', name: 'Grange Hall' },
      { id: 'loc-2', name: 'Town Hall' },
    ])
    expect(result.current.isLoading).toBe(false)
  })

  it('interpolates a different table name for a different owner table', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    renderHook(() => useOwnerTableOptions('key_moves'))

    expect(useQueryMock).toHaveBeenCalledWith('SELECT id, name FROM key_moves ORDER BY name')
  })
})

describe('createOwnerTableOption', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('inserts a new row into the given table with a generated id, and returns that id', async () => {
    const id = await createOwnerTableOption('choreographers', 'Bob Isaacs')

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(db.execute).toHaveBeenCalledWith('INSERT INTO choreographers (id, name) VALUES (?, ?)', [id, 'Bob Isaacs'])
  })
})
