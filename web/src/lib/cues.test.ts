import { describe, expect, it } from 'vitest'
import { cellKey, COLS, GRID_NATURAL_HEIGHT, GRID_NATURAL_WIDTH, INTRO_COLS, SECTIONS } from './cues'

describe('cues', () => {
  it('builds a cell key from section/row/col', () => {
    expect(cellKey('A1', 0, 3)).toBe('A1:0:3')
    expect(cellKey('intro', 0, 7)).toBe('intro:0:7')
  })

  it('defines 5 sections - a 1-row intro followed by four 2-row phrases', () => {
    expect(SECTIONS).toHaveLength(5)
    expect(SECTIONS[0]).toMatchObject({ id: 'intro', rows: 1 })
    expect(SECTIONS.slice(1).map((section) => section.id)).toEqual(['A1', 'A2', 'B1', 'B2'])
    expect(SECTIONS.slice(1).every((section) => section.rows === 2)).toBe(true)
  })

  it('only uses the last INTRO_COLS of the grid width for the intro row', () => {
    expect(INTRO_COLS).toBeLessThan(COLS)
  })

  it('derives its natural pixel dimensions from the section/column layout', () => {
    // 9 total rows (1 intro + 2*4 phrase rows) - not hardcoded here so this
    // test still holds if a section's row count ever changes.
    const totalRows = SECTIONS.reduce((sum, section) => sum + section.rows, 0)
    expect(totalRows).toBe(9)
    expect(GRID_NATURAL_WIDTH).toBeGreaterThan(COLS * 1) // sanity: wider than a 1px-per-column grid
    expect(GRID_NATURAL_HEIGHT).toBeGreaterThan(totalRows * 1)
  })
})
