import { describe, expect, it } from 'vitest'
import { appendFigure, appendNote, removeFigureItem, updateFigureItem } from './figures'
import { getDefaultSkeleton } from './phraseSkeleton'
import type { FigureItem } from './figures'

function makeFigures(): FigureItem[] {
  return [
    { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' },
    { id: 'n1', kind: 'note', text: 'Watch the timing' },
  ]
}

describe('updateFigureItem', () => {
  it("patches a figure's own field, leaving every other item untouched", () => {
    const result = updateFigureItem(makeFigures(), 'f1', { description: 'Circle right' })
    expect(result[0]).toEqual({ id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle right' })
    expect(result[1]).toEqual({ id: 'n1', kind: 'note', text: 'Watch the timing' })
  })

  it("patches a note's own field", () => {
    const result = updateFigureItem(makeFigures(), 'n1', { text: 'Slow down here' })
    expect(result[1]).toEqual({ id: 'n1', kind: 'note', text: 'Slow down here' })
  })

  it('patches phrase and beats independently', () => {
    const result = updateFigureItem(makeFigures(), 'f1', { beats: 12 })
    expect(result[0]).toMatchObject({ phrase: 'A1', beats: 12 })
  })

  it('returns a new array without mutating the original', () => {
    const original = makeFigures()
    const result = updateFigureItem(original, 'f1', { description: 'Circle right' })
    expect(original[0]).toMatchObject({ description: 'Circle left' })
    expect(result).not.toBe(original)
  })
})

describe('removeFigureItem', () => {
  it('removes the item with the given id', () => {
    expect(removeFigureItem(makeFigures(), 'f1')).toEqual([{ id: 'n1', kind: 'note', text: 'Watch the timing' }])
  })

  it('leaves the array unchanged if the id is not found', () => {
    const original = makeFigures()
    expect(removeFigureItem(original, 'missing')).toEqual(original)
  })
})

describe('appendNote', () => {
  it('appends a blank note with a fresh id', () => {
    const result = appendNote(makeFigures())
    expect(result).toHaveLength(3)
    expect(result[2]).toMatchObject({ kind: 'note', text: '' })
    expect(result[2]!.id).toBeTruthy()
  })
})

describe('appendFigure', () => {
  const contraSkeleton = getDefaultSkeleton('Contra')

  it('prefills phrase/beats from the skeleton based on the running beat total', () => {
    // f1 already accounts for 8 beats, so a new figure starts 8 beats into A1 (8 remaining in that span).
    const result = appendFigure(makeFigures(), contraSkeleton)
    expect(result[2]).toMatchObject({ kind: 'figure', phrase: 'A1', beats: 8, description: '' })
  })

  it('advances into the next phrase once the running total crosses a span boundary', () => {
    const figures: FigureItem[] = [{ id: 'f1', kind: 'figure', phrase: 'A1', beats: 16, description: 'Circle left' }]
    const result = appendFigure(figures, contraSkeleton)
    expect(result[1]).toMatchObject({ phrase: 'A2', beats: 16 })
  })

  it('falls back to null beats and the previous figure\'s phrase when no skeleton applies', () => {
    const result = appendFigure(makeFigures(), null)
    expect(result[2]).toMatchObject({ kind: 'figure', phrase: 'A1', beats: null, description: '' })
  })

  it('defaults to an empty phrase with no skeleton and no prior figures', () => {
    const result = appendFigure([], null)
    expect(result[0]).toMatchObject({ phrase: '', beats: null })
  })

  it('ignores notes when summing beats for the running total', () => {
    const figures: FigureItem[] = [
      { id: 'f1', kind: 'figure', phrase: 'A1', beats: 16, description: 'Circle left' },
      { id: 'n1', kind: 'note', text: 'A note with no beats of its own' },
    ]
    const result = appendFigure(figures, contraSkeleton)
    expect(result[2]).toMatchObject({ phrase: 'A2', beats: 16 })
  })
})
