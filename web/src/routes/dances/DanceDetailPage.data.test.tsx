import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDance } from './DanceDetailPage.data'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

describe('useDance', () => {
  it('queries a single dance by id, parameterized, with the same joins DancesPage.data.ts uses', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    renderHook(() => useDance('42'))

    const [query, params] = useQueryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('FROM dances')
    expect(query).toContain('WHERE dances.id = ?')
    expect(query).toContain('AS choreographers')
    expect(query).toContain('AS key_moves')
    expect(query).toContain('AS vibes')
    expect(query).toContain('AS programs')
    expect(query).toContain('dances.versions')
    expect(params).toEqual(['42'])
  })

  it('returns null while loading and once loaded with no matching row', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })
    const { result, rerender } = renderHook(() => useDance('missing'))
    expect(result.current).toEqual({ dance: null, isLoading: true })

    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    rerender()
    expect(result.current).toEqual({ dance: null, isLoading: false })
  })

  it('parses the tag-list and program-history JSON columns into real arrays once a row loads', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          id: '1',
          title: 'Chorus Jig',
          difficulty: 3,
          dance_type: 'Contra',
          formation: 'Duple Minor - Becket',
          progression: 'Single',
          notes: 'A classic.',
          created_at: '2026-01-15T12:00:00.000Z',
          updated_at: '2026-03-20T12:00:00.000Z',
          choreographers: '["Alice"]',
          key_moves: '["Hey"]',
          vibes: '["Playful"]',
          programs: '[{"id":"p1","date":"2026-01-01","location":"Grange Hall"}]',
          versions: '[]',
        },
      ],
      isLoading: false,
    })

    const { result } = renderHook(() => useDance('1'))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.dance).toEqual(
      expect.objectContaining({
        id: '1',
        title: 'Chorus Jig',
        choreographers: ['Alice'],
        key_moves: ['Hey'],
        vibes: ['Playful'],
        programs: [{ id: 'p1', date: '2026-01-01', location: 'Grange Hall' }],
        versions: [],
      }),
    )
  })

  it('parses versions into an array of {id, label, figures, notes} objects', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          id: '1',
          title: 'Chorus Jig',
          difficulty: null,
          dance_type: null,
          formation: null,
          progression: null,
          notes: null,
          created_at: '2026-01-15T12:00:00.000Z',
          updated_at: '2026-03-20T12:00:00.000Z',
          choreographers: '[]',
          key_moves: '[]',
          vibes: '[]',
          programs: '[]',
          versions: JSON.stringify([
            {
              id: 'v1',
              label: 'Choreography',
              figures: [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }],
              notes: 'Danced at half speed.',
            },
            { id: 'v2', label: 'Calling', figures: [{ id: 'c1', kind: 'note', text: '<p>Call it slow</p>' }], notes: null },
          ]),
        },
      ],
      isLoading: false,
    })

    const { result } = renderHook(() => useDance('1'))

    expect(result.current.dance?.versions).toEqual([
      {
        id: 'v1',
        label: 'Choreography',
        figures: [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: '<p>Circle left</p>' }],
        notes: 'Danced at half speed.',
      },
      { id: 'v2', label: 'Calling', figures: [{ id: 'c1', kind: 'note', text: '<p>Call it slow</p>' }], notes: null },
    ])
  })
})
