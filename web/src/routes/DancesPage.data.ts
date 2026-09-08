import { useQuery } from '@powersync/react'
import type { Dance } from '@/lib/powersync/schema'
import type { DanceWithJoins } from './DancesPage.columns'

// Builds correlated subquery for a dance's tag-style join (e.g. choreographers).
// This is a list of an owning entity's names via its junction table,
// aggregated with json_group_array rather than GROUP_CONCAT so a name
// containing ", " can't be misread as two separate names when split back apart.
// Table/column names are hardcoded, never user input.
function tagListSubquery(junctionTable: string, ownerTable: string, foreignKeyColumn: string): string {
  return `
    (
      SELECT json_group_array(name)
      FROM (
        SELECT ${ownerTable}.name AS name
        FROM ${junctionTable}
        JOIN ${ownerTable} ON ${ownerTable}.id = ${junctionTable}.${foreignKeyColumn}
        WHERE ${junctionTable}.dance_id = dances.id
        ORDER BY ${ownerTable}.name
      )
    )
  `
}

const DANCES_QUERY = `
  SELECT
    dances.id, dances.title, dances.difficulty, dances.formation, dances.notes,
    dances.created_at, dances.updated_at,
    ${tagListSubquery('dances_choreographers', 'choreographers', 'choreographer_id')} AS choreographers
  FROM dances
`

export function useDances(): { dances: DanceWithJoins[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `dances`,
  // `dances_choreographers`, or `choreographers` tables change.
  const { data: rawDances, isLoading } = useQuery<Dance & { choreographers: string }>(DANCES_QUERY)

  // Parsed once here rather than in each cell renderer. No useMemo needed -
  // React Compiler auto-memoizes this the same way, keyed on rawDances.
  const dances: DanceWithJoins[] = rawDances.map((d) => ({
    ...d,
    choreographers: JSON.parse(d.choreographers) as string[],
  }))

  return { dances, isLoading }
}
