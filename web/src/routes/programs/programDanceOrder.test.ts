import { describe, expect, it } from 'vitest'
import { renumberSequentially } from './programDanceOrder'
import type { ProgramDance } from './ProgramsPage.columns'

describe('renumberSequentially', () => {
  it("gives each dance a fresh 1-based order matching its position in the list, ignoring each dance's own stale order", () => {
    const dances: ProgramDance[] = [
      { programDanceId: 'pd-3', danceId: 'd-3', order: 0, title: 'Reel of Four' },
      { programDanceId: 'pd-1', danceId: 'd-1', order: 5, title: 'Chorus Jig' },
      { programDanceId: 'pd-2', danceId: 'd-2', order: 5, title: 'Money Musk' },
    ]

    expect(renumberSequentially(dances)).toEqual([
      { programDanceId: 'pd-3', danceId: 'd-3', order: 1, title: 'Reel of Four' },
      { programDanceId: 'pd-1', danceId: 'd-1', order: 2, title: 'Chorus Jig' },
      { programDanceId: 'pd-2', danceId: 'd-2', order: 3, title: 'Money Musk' },
    ])
  })

  it('returns an empty array unchanged', () => {
    expect(renumberSequentially([])).toEqual([])
  })
})
