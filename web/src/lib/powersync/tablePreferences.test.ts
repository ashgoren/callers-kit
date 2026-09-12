import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './database' // Actually loads the mock below, not the real module.
import { parseColumnState, resolveUpdater, writeColumnState } from './tablePreferences'
import type { TableColumnState } from './tablePreferences'

vi.mock('./database', () => ({
  db: { execute: vi.fn() },
}))

const defaults: TableColumnState = {
  columnVisibility: {},
  sorting: [{ id: 'title', desc: false }],
  columnPinning: { start: ['title'], end: [] },
  columnOrder: [],
  columnSizing: {},
}

describe('parseColumnState', () => {
  it('returns the defaults untouched when there is no row yet', () => {
    expect(parseColumnState(undefined, defaults)).toBe(defaults)
  })

  it('merges a stored row over the defaults, field by field', () => {
    const row = {
      id: '1',
      column_state: JSON.stringify({ columnVisibility: { notes: false }, sorting: [{ id: 'difficulty', desc: true }] }),
    }

    expect(parseColumnState(row, defaults)).toEqual({
      ...defaults,
      columnVisibility: { notes: false },
      sorting: [{ id: 'difficulty', desc: true }],
    })
  })

  it('falls back to the default for a field missing from an older stored row (e.g. columnSizing added later)', () => {
    const row = { id: '1', column_state: JSON.stringify({ columnOrder: ['title', 'notes'] }) }

    expect(parseColumnState(row, defaults)).toEqual({ ...defaults, columnOrder: ['title', 'notes'] })
  })

  it('drops unrecognized keys instead of carrying them forward', () => {
    // Regression guard: a row corrupted by a past bug held a huge unrelated
    // blob under an unexpected key, and a blind `{ ...defaults, ...stored }`
    // spread would have carried it into every future write via commit()'s
    // own spread of this function's return value - permanently, since
    // nothing else ever strips unknown keys back out.
    const row = {
      id: '1',
      column_state: JSON.stringify({ columnOrder: ['title'], junk: 'x'.repeat(1000) }),
    }

    expect(parseColumnState(row, defaults)).toEqual({ ...defaults, columnOrder: ['title'] })
  })

  it('falls back to the defaults instead of throwing when column_state is not valid JSON', () => {
    const row = { id: '1', column_state: 'not valid json' }

    expect(parseColumnState(row, defaults)).toEqual(defaults)
  })
})

describe('resolveUpdater', () => {
  it('returns a plain value as-is', () => {
    expect(resolveUpdater([{ id: 'title', desc: true }], [])).toEqual([{ id: 'title', desc: true }])
  })

  it('calls a function updater with the current value', () => {
    const updater = (old: string[]) => [...old, 'new']
    expect(resolveUpdater(updater, ['existing'])).toEqual(['existing', 'new'])
  })
})

describe('writeColumnState', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('updates the row by id', async () => {
    await writeColumnState('42', defaults)

    expect(db.execute).toHaveBeenCalledWith('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [
      JSON.stringify(defaults),
      '42',
    ])
  })
})
