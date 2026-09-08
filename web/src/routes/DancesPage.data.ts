import { useQuery, useStatus } from '@powersync/react'
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
    ${tagListSubquery('dances_choreographers', 'choreographers', 'choreographer_id')} AS choreographers,
    ${tagListSubquery('dances_key_moves', 'key_moves', 'key_move_id')} AS key_moves,
    ${tagListSubquery('dances_vibes', 'vibes', 'vibe_id')} AS vibes
  FROM dances
`

// The shape of a row as it comes back from DANCES_QUERY, before the
// tag-list columns are JSON.parse'd into real arrays below.
type DanceQueryRow = Dance & { choreographers: string; key_moves: string; vibes: string }

export function useDances(): { dances: DanceWithJoins[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `dances`,
  // `dances_choreographers`/`choreographers`, `dances_key_moves`/`key_moves`,
  // or `dances_vibes`/`vibes` tables change.
  const { data: rawDances, isLoading: queryLoading } = useQuery<DanceQueryRow>(DANCES_QUERY)
  const { hasSynced } = useStatus()

  // useQuery's isLoading only reflects whether the LOCAL query has run once,
  // not whether the initial sync from the server has finished
  // Without also checking hasSynced, the table would show no dances
  // for a moment rather than staying in a loading state.
  const isLoading = queryLoading || !hasSynced

  // Parsed once here rather than in each cell renderer. No useMemo needed -
  // React Compiler auto-memoizes this the same way, keyed on rawDances.
  const dances: DanceWithJoins[] = rawDances.map((d) => ({
    ...d,
    choreographers: JSON.parse(d.choreographers) as string[],
    key_moves: JSON.parse(d.key_moves) as string[],
    vibes: JSON.parse(d.vibes) as string[],
  }))

  return { dances, isLoading }
}
