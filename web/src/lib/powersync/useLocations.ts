import { useQuery } from '@powersync/react'
import { db } from './database'
import type { Location } from './schema'

export function useLocations(): { locations: Location[]; isLoading: boolean } {
  const { data: locations, isLoading } = useQuery<Location>('SELECT id, name FROM locations ORDER BY name')
  return { locations, isLoading }
}

// user_id is deliberately not set here: it isn't part of the local
// PowerSync schema for locations (see schema.ts), and the locations table's
// own `default auth.uid()` fills it in server-side once this insert
// uploads through the normal authenticated Supabase write path.
export async function createLocation(name: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.execute('INSERT INTO locations (id, name) VALUES (?, ?)', [id, name])
  return id
}
