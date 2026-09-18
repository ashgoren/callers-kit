import { useQuery } from '@powersync/react'
import { db } from './database'

// The small, closed set of tables this applies to: each is an owner table
// (its own user_id column, no junction) holding nothing but a user-chosen
// name - locations, choreographers, key_moves, vibes.
export type OwnerTableName = 'locations' | 'choreographers' | 'key_moves' | 'vibes'

export interface OwnerTableOption {
  id: string
  name: string | null
}

export function useOwnerTableOptions(table: OwnerTableName): { options: OwnerTableOption[]; isLoading: boolean } {
  const { data: options, isLoading } = useQuery<OwnerTableOption>(`SELECT id, name FROM ${table} ORDER BY name`)
  return { options, isLoading }
}

// Row creation: id is generated here rather than left to a db default.
// user_id is deliberately not set here: it isn't part of any of these
// tables' local PowerSync schema (see schema.ts), and each table's own
// `default auth.uid()` fills it in server-side once this insert uploads
// through the normal authenticated Supabase write path.
export async function createOwnerTableOption(table: OwnerTableName, name: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.execute(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, name])
  return id
}
