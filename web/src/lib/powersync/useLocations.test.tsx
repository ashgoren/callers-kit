import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './database' // Actually loads the mock below, not the real module.
import { createLocation, useLocations } from './useLocations'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

vi.mock('./database', () => ({
  db: { execute: vi.fn() },
}))

describe('useLocations', () => {
  it('queries every location alphabetically by name', () => {
    useQueryMock.mockReturnValue({
      data: [
        { id: 'loc-1', name: 'Grange Hall' },
        { id: 'loc-2', name: 'Town Hall' },
      ],
      isLoading: false,
    })

    const { result } = renderHook(() => useLocations())

    expect(useQueryMock).toHaveBeenCalledWith('SELECT id, name FROM locations ORDER BY name')
    expect(result.current.locations).toEqual([
      { id: 'loc-1', name: 'Grange Hall' },
      { id: 'loc-2', name: 'Town Hall' },
    ])
    expect(result.current.isLoading).toBe(false)
  })
})

describe('createLocation', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('inserts a new row with a generated id and the given name, and returns that id', async () => {
    const id = await createLocation('Grange Hall')

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(db.execute).toHaveBeenCalledWith('INSERT INTO locations (id, name) VALUES (?, ?)', [id, 'Grange Hall'])
  })
})
