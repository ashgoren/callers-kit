import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitCueCellEdit, commitCueNotesEdit, commitCueSeparatorToggle } from './commitCueEdit'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import type { CuesData } from '@/lib/cues'

vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

function makeCues(): CuesData {
  return {
    cells: { 'A1:0:0': 'Circle left', 'A1:0:1': 'Swing' },
    separators: ['A1:0:0'],
    notes: 'Call it slow the first time',
  }
}

describe('commitCueCellEdit', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('sets a cell, leaving every other part of the blob untouched', async () => {
    await commitCueCellEdit('v1', makeCues(), 'A1:0:1', 'Swing your partner')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [
      JSON.stringify({
        cells: { 'A1:0:0': 'Circle left', 'A1:0:1': 'Swing your partner' },
        separators: ['A1:0:0'],
        notes: 'Call it slow the first time',
      }),
      'v1',
    ])
  })

  it('removes a cell entirely when committed empty, rather than storing an empty string', async () => {
    await commitCueCellEdit('v1', makeCues(), 'A1:0:1', null)

    const [, params] = vi.mocked(db.execute).mock.calls[0] as [string, unknown[]]
    const written = JSON.parse(params[0] as string) as CuesData
    expect(written.cells).toEqual({ 'A1:0:0': 'Circle left' })
  })

  it('adds a new cell to a version with no cues yet', async () => {
    await commitCueCellEdit('v1', null, 'A1:0:0', 'Circle left')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [
      JSON.stringify({ cells: { 'A1:0:0': 'Circle left' } }),
      'v1',
    ])
  })

  it('collapses to null once the last cell, separator, and note are all gone', async () => {
    const onlyOneCell: CuesData = { cells: { 'A1:0:0': 'Circle left' } }
    await commitCueCellEdit('v1', onlyOneCell, 'A1:0:0', null)

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [null, 'v1'])
  })
})

describe('commitCueSeparatorToggle', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('adds a separator on a cell that does not have one yet', async () => {
    await commitCueSeparatorToggle('v1', makeCues(), 'A1:0:1')

    const [, params] = vi.mocked(db.execute).mock.calls[0] as [string, unknown[]]
    const written = JSON.parse(params[0] as string) as CuesData
    expect(written.separators).toEqual(expect.arrayContaining(['A1:0:0', 'A1:0:1']))
  })

  it('removes a separator that is already there, toggling back off', async () => {
    await commitCueSeparatorToggle('v1', makeCues(), 'A1:0:0')

    const [, params] = vi.mocked(db.execute).mock.calls[0] as [string, unknown[]]
    const written = JSON.parse(params[0] as string) as CuesData
    expect(written.separators).toBeUndefined()
  })
})

describe('commitCueNotesEdit', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('updates notes, leaving cells and separators untouched', async () => {
    await commitCueNotesEdit('v1', makeCues(), 'Watch the timing on the swing')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET cues = ? WHERE id = ?', [
      JSON.stringify({
        cells: { 'A1:0:0': 'Circle left', 'A1:0:1': 'Swing' },
        separators: ['A1:0:0'],
        notes: 'Watch the timing on the swing',
      }),
      'v1',
    ])
  })

  it('clears notes without discarding an otherwise-populated grid', async () => {
    await commitCueNotesEdit('v1', makeCues(), null)

    const [, params] = vi.mocked(db.execute).mock.calls[0] as [string, unknown[]]
    const written = JSON.parse(params[0] as string) as CuesData
    expect(written.notes).toBeUndefined()
    expect(written.cells).toEqual({ 'A1:0:0': 'Circle left', 'A1:0:1': 'Swing' })
  })
})
