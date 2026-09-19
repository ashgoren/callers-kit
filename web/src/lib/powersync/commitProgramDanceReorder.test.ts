import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addProgramDance, removeProgramDance, reorderProgramDances } from './commitProgramDanceReorder'
import { db } from './database' // Actually loads the mock below, not the real module.
import type { Mock } from 'vitest'
import type { ProgramDance } from '@/routes/programs/ProgramsPage.columns'

vi.mock('./database', () => ({
  db: { execute: vi.fn(), writeTransaction: vi.fn() },
}))

// The real `db` export is a PowerSyncDatabase instance, so TypeScript infers
// `import('./database').db` at that type regardless of the vi.mock() above
// swapping its runtime value - and writeTransaction, being a real class
// method, carries an implicit `this` that trips @typescript-eslint/
// unbound-method wherever it's passed around as a bare reference below (see
// PowerSyncProvider.test.tsx for the same pattern). This type describes what
// the mock actually is at runtime, decoupling it from the real class - a
// concrete callback signature (rather than the generic ReturnType<typeof
// vi.fn>) is also what lets mockImplementation below accept an async
// callback without @typescript-eslint/no-misused-promises misreading it as a
// void-returning function.
type MockTx = { execute: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as { writeTransaction: Mock<(callback: (tx: MockTx) => Promise<void>) => Promise<void>> }

describe('reorderProgramDances', () => {
  beforeEach(() => {
    mockDb.writeTransaction.mockClear()
  })

  it("writes each dance's own given order, not a recomputed one, in one write transaction", async () => {
    const tx: MockTx = { execute: vi.fn() }
    mockDb.writeTransaction.mockImplementation(async (callback) => callback(tx))

    const dances: ProgramDance[] = [
      { programDanceId: 'pd-3', danceId: 'd-3', order: 1, title: 'Reel of Four' },
      { programDanceId: 'pd-1', danceId: 'd-1', order: 2, title: 'Chorus Jig' },
      { programDanceId: 'pd-2', danceId: 'd-2', order: 3, title: 'Money Musk' },
    ]
    await reorderProgramDances(dances)

    expect(mockDb.writeTransaction).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenNthCalledWith(1, 'UPDATE programs_dances SET "order" = ? WHERE id = ?', [1, 'pd-3'])
    expect(tx.execute).toHaveBeenNthCalledWith(2, 'UPDATE programs_dances SET "order" = ? WHERE id = ?', [2, 'pd-1'])
    expect(tx.execute).toHaveBeenNthCalledWith(3, 'UPDATE programs_dances SET "order" = ? WHERE id = ?', [3, 'pd-2'])
  })
})

describe('addProgramDance', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('inserts a new junction row with a generated id at the given order, and returns that id', async () => {
    const id = await addProgramDance('program-1', 'dance-1', 2)

    expect(db.execute).toHaveBeenCalledTimes(1)
    const [sql, params] = vi.mocked(db.execute).mock.calls[0]
    expect(sql).toBe('INSERT INTO programs_dances (id, program_id, dance_id, "order") VALUES (?, ?, ?, ?)')
    expect(params).toEqual([id, 'program-1', 'dance-1', 2])
  })
})

describe('removeProgramDance', () => {
  beforeEach(() => {
    mockDb.writeTransaction.mockClear()
  })

  it('deletes the junction row and renumbers the remaining dances, in one write transaction', async () => {
    const tx: MockTx = { execute: vi.fn() }
    mockDb.writeTransaction.mockImplementation(async (callback) => callback(tx))

    const remaining: ProgramDance[] = [
      { programDanceId: 'pd-1', danceId: 'd-1', order: 1, title: 'Chorus Jig' },
      { programDanceId: 'pd-3', danceId: 'd-3', order: 2, title: 'Reel of Four' },
    ]
    await removeProgramDance('pd-2', remaining)

    expect(mockDb.writeTransaction).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenNthCalledWith(1, 'DELETE FROM programs_dances WHERE id = ?', ['pd-2'])
    expect(tx.execute).toHaveBeenNthCalledWith(2, 'UPDATE programs_dances SET "order" = ? WHERE id = ?', [1, 'pd-1'])
    expect(tx.execute).toHaveBeenNthCalledWith(3, 'UPDATE programs_dances SET "order" = ? WHERE id = ?', [2, 'pd-3'])
  })

  it('just deletes, with no renumbering writes, when nothing is left', async () => {
    const tx: MockTx = { execute: vi.fn() }
    mockDb.writeTransaction.mockImplementation(async (callback) => callback(tx))

    await removeProgramDance('pd-1', [])

    expect(tx.execute).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenCalledWith('DELETE FROM programs_dances WHERE id = ?', ['pd-1'])
  })
})
