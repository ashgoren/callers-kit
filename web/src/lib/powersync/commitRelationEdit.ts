import { db } from './database'

// The parallel to commitFieldEdit for a junction-table relation (attaching/detaching a choreographer, key move, or vibe).
export async function commitRelationEdit(
  junctionTable: string,
  refIdColumn: string,
  danceId: string,
  refId: string,
  action: 'add' | 'remove',
): Promise<void> {
  if (action === 'add') {
    const id = crypto.randomUUID()
    await db.execute(`INSERT INTO ${junctionTable} (id, dance_id, ${refIdColumn}) VALUES (?, ?, ?)`, [id, danceId, refId])
  } else {
    await db.execute(`DELETE FROM ${junctionTable} WHERE dance_id = ? AND ${refIdColumn} = ?`, [danceId, refId])
  }
}
