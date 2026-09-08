import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitFieldEdit } from './commitFieldEdit'
import { db } from './database' // Actually loads the mock below, not the real module.

// Mocking the whole module (rather than just db.execute) means real
// PowerSync/wa-sqlite code never loads during this test at all - the mock
// factory below is hoisted by Vitest above the imports, so it fully replaces
// './database' before commitFieldEdit.ts's own import of it resolves.
vi.mock('./database', () => ({
  db: { execute: vi.fn() },
}))

describe('commitFieldEdit', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('runs an UPDATE with the table/column interpolated and value/id parameterized', async () => {
    await commitFieldEdit('dances', '42', 'title', 'New Title')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET title = ? WHERE id = ?', [
      'New Title',
      '42',
    ])
  })

  it('supports clearing a field to NULL, distinct from an empty string', async () => {
    await commitFieldEdit('dances', '42', 'notes', null)

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET notes = ? WHERE id = ?', [
      null,
      '42',
    ])
  })
})
