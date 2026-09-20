import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useProgramChoreographyDances } from './ProgramChoreographyPage.data'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    dance_id: 'd1',
    title: 'Chorus Jig',
    order: 1,
    dance_type: 'Contra',
    formation: 'Duple Minor - Becket',
    progression: 'Single',
    figures: '[{"id":"f1","kind":"figure","phrase":"","beats":16,"description":"Circle left"}]',
    manual_phrasing: 0,
    key_moves: '[]',
    ...overrides,
  }
}

describe('useProgramChoreographyDances', () => {
  it('queries by program id, joined to each dance\'s primary (lowest-order) version, in lineup order', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    renderHook(() => useProgramChoreographyDances('42'))

    const [query, params] = useQueryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('FROM programs_dances')
    expect(query).toContain('JOIN dances ON dances.id = programs_dances.dance_id')
    expect(query).toContain('LEFT JOIN dance_versions ON dance_versions.id = (')
    expect(query).toContain('ORDER BY "order" LIMIT 1')
    expect(query).toContain('WHERE programs_dances.program_id = ?')
    expect(query).toContain('ORDER BY programs_dances."order"')
    expect(query).toContain('AS key_moves')
    expect(query).toContain('programs_dances."order" AS "order"')
    expect(params).toEqual(['42'])
  })

  it('parses figures/key_moves JSON and coerces manual_phrasing to a real boolean', () => {
    useQueryMock.mockReturnValue({
      data: [makeRow({ manual_phrasing: 1, key_moves: '[{"id":"k1","name":"Hey"}]' })],
      isLoading: false,
    })

    const { result } = renderHook(() => useProgramChoreographyDances('42'))

    expect(result.current).toEqual({
      dances: [
        {
          danceId: 'd1',
          title: 'Chorus Jig',
          order: 1,
          danceType: 'Contra',
          formation: 'Duple Minor - Becket',
          progression: 'Single',
          manualPhrasing: true,
          figures: [{ id: 'f1', kind: 'figure', phrase: '', beats: 16, description: 'Circle left' }],
          keyMoves: [{ id: 'k1', name: 'Hey' }],
        },
      ],
      isLoading: false,
    })
  })

  it('gives a dance with no versions at all an empty figures array, rather than throwing on a null column', () => {
    useQueryMock.mockReturnValue({ data: [makeRow({ figures: null, manual_phrasing: null })], isLoading: false })

    const { result } = renderHook(() => useProgramChoreographyDances('42'))

    expect(result.current.dances[0]).toMatchObject({ figures: [], manualPhrasing: false })
  })
})
