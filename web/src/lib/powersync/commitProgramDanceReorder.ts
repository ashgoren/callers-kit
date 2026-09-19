import { db } from './database'
import type { ProgramDance } from '@/routes/programs/ProgramsPage.columns'

// Writes each dance's own (already-renumbered) order in one write transaction.
export async function reorderProgramDances(dances: ProgramDance[]): Promise<void> {
  await db.writeTransaction(async (tx) => {
    for (const dance of dances) {
      await tx.execute('UPDATE programs_dances SET "order" = ? WHERE id = ?', [dance.order, dance.programDanceId])
    }
  })
}

// Attaches a dance to a program's lineup. id is client-generated. Returns
// it so optimistic UI can use the real committed id up front.
export async function addProgramDance(programId: string, danceId: string, order: number): Promise<string> {
  const id = crypto.randomUUID()
  await db.execute('INSERT INTO programs_dances (id, program_id, dance_id, "order") VALUES (?, ?, ?, ?)', [
    id,
    programId,
    danceId,
    order,
  ])
  return id
}

// Deletes a dance from a program's lineup and renumbers whatever's left.
export async function removeProgramDance(programDanceId: string, remainingDances: ProgramDance[]): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute('DELETE FROM programs_dances WHERE id = ?', [programDanceId])
    for (const dance of remainingDances) {
      await tx.execute('UPDATE programs_dances SET "order" = ? WHERE id = ?', [dance.order, dance.programDanceId])
    }
  })
}
