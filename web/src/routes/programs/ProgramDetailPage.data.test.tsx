import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useProgram } from './ProgramDetailPage.data'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

describe('useProgram', () => {
  it('queries a single program by id, parameterized, with the same dance-lineup join ProgramsPage.data.ts uses', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    renderHook(() => useProgram('42'))

    const [query, params] = useQueryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('FROM programs')
    expect(query).toContain('WHERE programs.id = ?')
    expect(query).toContain('AS dances')
    expect(params).toEqual(['42'])
  })

  it('returns null while loading and once loaded with no matching row', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    const { result, rerender } = renderHook(() => useProgram('missing'))
    expect(result.current).toEqual({ program: null, isLoading: true })

    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    rerender()
    expect(result.current).toEqual({ program: null, isLoading: false })
  })

  it('parses the dance-lineup JSON column into a real array once a row loads', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          id: '1',
          date: '2026-09-13',
          location: 'Grange Hall',
          notes: 'Bring extra chairs.',
          created_at: '2026-01-15T12:00:00.000Z',
          updated_at: '2026-03-20T12:00:00.000Z',
          dances: '[{"programDanceId":"pd-1","danceId":"d-1","order":1,"title":"Chorus Jig"}]',
        },
      ],
      isLoading: false,
    })

    const { result } = renderHook(() => useProgram('1'))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.program).toEqual(
      expect.objectContaining({
        id: '1',
        location: 'Grange Hall',
        dances: [{ programDanceId: 'pd-1', danceId: 'd-1', order: 1, title: 'Chorus Jig' }],
      }),
    )
  })
})
