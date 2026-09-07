import { useMemo } from 'react'
import { useQuery } from '@powersync/react'
import type { Dance } from '@/lib/powersync/schema'
import type { DanceWithChoreographers } from './DancesPage.columns'

// A correlated subquery, not a standalone query.
// Comes back as a JSON array string via json_group_array, then parsed below -
// json_group_array rather than GROUP_CONCAT so a choreographer name
// containing ", " can't be misread as two separate names when split back apart.
const CHOREOGRAPHERS_SUBQUERY = `
  (
    SELECT json_group_array(name)
    FROM (
      SELECT c.name AS name
      FROM dances_choreographers dc
      JOIN choreographers c ON c.id = dc.choreographer_id
      WHERE dc.dance_id = d.id
      ORDER BY c.name
    )
  )
`

const DANCES_QUERY = `
  SELECT
    d.id, d.title, d.difficulty, d.formation, d.notes, d.created_at, d.updated_at,
    ${CHOREOGRAPHERS_SUBQUERY} AS choreographers
  FROM dances d
`

export function useDances(): { dances: DanceWithChoreographers[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `dances`,
  // `dances_choreographers`, or `choreographers` tables change.
  const { data: rawDances, isLoading } = useQuery<Dance & { choreographers: string }>(DANCES_QUERY)

  // Parsed once here rather than in each cell renderer, and memoized so
  // TanStack Table's own memoization isn't invalidated by a fresh array of
  // fresh objects on every render when the underlying data hasn't changed.
  const dances = useMemo<DanceWithChoreographers[]>(
    () => rawDances.map((d) => ({ ...d, choreographers: JSON.parse(d.choreographers) as string[] })),
    [rawDances],
  )

  return { dances, isLoading }
}
