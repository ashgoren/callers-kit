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
      SELECT choreographers.name AS name
      FROM dances_choreographers
      JOIN choreographers ON choreographers.id = dances_choreographers.choreographer_id
      WHERE dances_choreographers.dance_id = dances.id
      ORDER BY choreographers.name
    )
  )
`

const DANCES_QUERY = `
  SELECT
    dances.id, dances.title, dances.difficulty, dances.formation, dances.notes,
    dances.created_at, dances.updated_at,
    ${CHOREOGRAPHERS_SUBQUERY} AS choreographers
  FROM dances
`

export function useDances(): { dances: DanceWithChoreographers[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `dances`,
  // `dances_choreographers`, or `choreographers` tables change.
  const { data: rawDances, isLoading } = useQuery<Dance & { choreographers: string }>(DANCES_QUERY)

  // Parsed once here rather than in each cell renderer. No useMemo needed -
  // React Compiler auto-memoizes this the same way, keyed on rawDances.
  const dances: DanceWithChoreographers[] = rawDances.map((d) => ({
    ...d,
    choreographers: JSON.parse(d.choreographers) as string[],
  }))

  return { dances, isLoading }
}
