import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDanceVersionWalkthrough } from './DanceWalkthroughPage.data'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

describe('useDanceVersionWalkthrough', () => {
  it('queries a single dance_versions row by its own id, when a version id is given', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    renderHook(() => useDanceVersionWalkthrough({ danceId: '42', versionId: 'v1' }))

    const [query, params] = useQueryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('FROM dance_versions')
    expect(query).toContain('JOIN dances ON dances.id = dance_versions.dance_id')
    expect(query).toContain('WHERE dance_versions.id = ?')
    expect(query).toContain('AS choreographers')
    expect(query).toContain('AS version_count')
    expect(params).toEqual(['v1'])
  })

  it('queries by dance id for the primary (lowest-order) version, when no version id is given', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    renderHook(() => useDanceVersionWalkthrough({ danceId: '42' }))

    const [query, params] = useQueryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('WHERE dance_versions.dance_id = ?')
    expect(query).toContain('ORDER BY dance_versions."order"')
    expect(query).toContain('LIMIT 1')
    expect(params).toEqual(['42'])
  })

  it('returns null while loading and once loaded with no matching row', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    const { result, rerender } = renderHook(() => useDanceVersionWalkthrough({ danceId: '42', versionId: 'missing' }))
    expect(result.current).toEqual({ version: null, isLoading: true })

    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    rerender()
    expect(result.current).toEqual({ version: null, isLoading: false })
  })

  it('returns the matching row once loaded, with choreographers parsed into a real array', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          id: 'v1',
          order: 0,
          label: 'Choreography',
          walkthrough: '<p>Walk it through slowly.</p>',
          dance_id: '42',
          dance_title: 'Chorus Jig',
          dance_type: 'Contra',
          formation: 'Duple Minor - Becket',
          progression: 'Single',
          choreographers: '["Alice"]',
          version_count: 1,
        },
      ],
      isLoading: false,
    })

    const { result } = renderHook(() => useDanceVersionWalkthrough({ danceId: '42', versionId: 'v1' }))

    expect(result.current).toEqual({
      version: {
        id: 'v1',
        order: 0,
        label: 'Choreography',
        walkthrough: '<p>Walk it through slowly.</p>',
        dance_id: '42',
        dance_title: 'Chorus Jig',
        dance_type: 'Contra',
        formation: 'Duple Minor - Becket',
        progression: 'Single',
        choreographers: ['Alice'],
        version_count: 1,
      },
      isLoading: false,
    })
  })
})
