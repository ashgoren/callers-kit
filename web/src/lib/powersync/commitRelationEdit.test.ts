import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitRelationEdit } from './commitRelationEdit'
import { db } from './database' // Actually loads the mock below, not the real module.

vi.mock('./database', () => ({
  db: { execute: vi.fn() },
}))

describe('commitRelationEdit', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('inserts a new junction row with a generated id when adding a relation', async () => {
    await commitRelationEdit('dances_choreographers', 'choreographer_id', 'dance-1', 'choreographer-1', 'add')

    expect(db.execute).toHaveBeenCalledTimes(1)
    const [sql, params] = vi.mocked(db.execute).mock.calls[0]
    expect(sql).toBe('INSERT INTO dances_choreographers (id, dance_id, choreographer_id) VALUES (?, ?, ?)')
    expect(params).toEqual([expect.any(String), 'dance-1', 'choreographer-1'])
  })

  it('deletes the matching junction row by dance_id and the ref column when removing a relation', async () => {
    await commitRelationEdit('dances_key_moves', 'key_move_id', 'dance-1', 'key-move-1', 'remove')

    expect(db.execute).toHaveBeenCalledWith('DELETE FROM dances_key_moves WHERE dance_id = ? AND key_move_id = ?', [
      'dance-1',
      'key-move-1',
    ])
  })

  it('interpolates a different junction table/column for a different relation', async () => {
    await commitRelationEdit('dances_vibes', 'vibe_id', 'dance-1', 'vibe-1', 'add')

    const [sql] = vi.mocked(db.execute).mock.calls[0]
    expect(sql).toBe('INSERT INTO dances_vibes (id, dance_id, vibe_id) VALUES (?, ?, ?)')
  })
})
