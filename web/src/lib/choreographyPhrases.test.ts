import { describe, expect, it } from 'vitest'
import { buildChoreographyRows } from './choreographyPhrases'
import type { ChoreographyDance } from './choreographyPhrases'
import type { FigureItem } from './figures'

function contraFigures(): FigureItem[] {
  return [
    { id: 'f1', kind: 'figure', phrase: 'wrong-on-purpose', beats: 16, description: 'Circle left' },
    { id: 'f2', kind: 'figure', phrase: 'wrong-on-purpose', beats: 16, description: 'Swing neighbor' },
  ]
}

describe('buildChoreographyRows', () => {
  it('groups a Contra dance\'s figures into computed A1/A2/B1/B2 rows, ignoring the stored phrase field', () => {
    const dances: ChoreographyDance[] = [
      { danceId: 'd1', title: 'Chorus Jig', danceType: 'Contra', manualPhrasing: false, figures: contraFigures() },
    ]

    const rows = buildChoreographyRows(dances)

    expect(rows.map((row) => row.phrase)).toEqual(['A1', 'A2'])
    expect(rows[0].figuresByDance[0]).toEqual([contraFigures()[0]])
    expect(rows[1].figuresByDance[0]).toEqual([contraFigures()[1]])
  })

  it('unions phrase labels across dances, first-encountered order across the whole lineup', () => {
    const dances: ChoreographyDance[] = [
      {
        danceId: 'd1',
        title: 'Contra One',
        danceType: 'Contra',
        manualPhrasing: false,
        figures: [{ id: 'f1', kind: 'figure', phrase: '', beats: 32, description: 'Long A1' }],
      },
      {
        danceId: 'd2',
        title: 'Money Musk',
        danceType: 'Contra',
        manualPhrasing: true,
        figures: [
          { id: 'f2', kind: 'figure', phrase: 'Intro', beats: null, description: 'Actives cross' },
          { id: 'f3', kind: 'figure', phrase: 'A1', beats: null, description: 'Down the hall' },
        ],
      },
    ]

    const rows = buildChoreographyRows(dances)

    // d1's own single 32-beat figure clamps to A1 (the skeleton's last
    // matching span for a Contra dance that runs long), so it never
    // reaches A2/B1/B2 - only 'A1' from d1, then d2's own manual labels,
    // are ever seen.
    expect(rows.map((row) => row.phrase)).toEqual(['A1', 'Intro'])
  })

  it('falls back to a non-Contra dance\'s own stored phrase field, since it has no default skeleton', () => {
    const dances: ChoreographyDance[] = [
      {
        danceId: 'd1',
        title: 'Circle Mixer',
        danceType: 'Mixer',
        manualPhrasing: false,
        figures: [{ id: 'f1', kind: 'figure', phrase: 'Verse', beats: 8, description: 'Circle left' }],
      },
    ]

    const rows = buildChoreographyRows(dances)

    expect(rows).toEqual([{ phrase: 'Verse', figuresByDance: [[dances[0].figures[0]]] }])
  })

  it('excludes notes, same as figures with no phrase of their own', () => {
    const dances: ChoreographyDance[] = [
      {
        danceId: 'd1',
        title: 'Chorus Jig',
        danceType: 'Contra',
        manualPhrasing: false,
        figures: [
          { id: 'f1', kind: 'figure', phrase: '', beats: 16, description: 'Circle left' },
          { id: 'n1', kind: 'note', text: 'Watch the timing' },
        ],
      },
    ]

    const rows = buildChoreographyRows(dances)

    expect(rows).toEqual([{ phrase: 'A1', figuresByDance: [[dances[0].figures[0]]] }])
  })

  it('gives a dance with no figures in a given phrase an empty cell for that row', () => {
    const dances: ChoreographyDance[] = [
      {
        danceId: 'd1',
        title: 'Chorus Jig',
        danceType: 'Contra',
        manualPhrasing: false,
        figures: [{ id: 'f1', kind: 'figure', phrase: '', beats: 16, description: 'Circle left' }],
      },
      {
        danceId: 'd2',
        title: 'Rory O\'More',
        danceType: 'Contra',
        manualPhrasing: false,
        figures: [{ id: 'f2', kind: 'figure', phrase: '', beats: 32, description: 'Long A1 for d2' }],
      },
    ]

    const rows = buildChoreographyRows(dances)

    const a1Row = rows.find((row) => row.phrase === 'A1')
    expect(a1Row?.figuresByDance[0]).toEqual([dances[0].figures[0]])
    expect(a1Row?.figuresByDance[1]).toEqual([dances[1].figures[0]])
    // d1 has nothing past A1; d2's single figure clamps to A1, so neither
    // dance ever contributes to a row past A1, and no such row exists at
    // all - "empty cell" only ever applies to a phrase row that does exist.
    expect(rows).toHaveLength(1)
  })

  it('returns no rows for dances with no figures at all', () => {
    const dances: ChoreographyDance[] = [{ danceId: 'd1', title: 'Empty Dance', danceType: 'Contra', manualPhrasing: false, figures: [] }]
    expect(buildChoreographyRows(dances)).toEqual([])
  })
})
