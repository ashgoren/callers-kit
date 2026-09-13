import { useQuery } from '@powersync/react'
import type { Program } from '@/lib/powersync/schema'
import type { ProgramWithJoins } from './ProgramsPage.columns'

// Builds the correlated subquery for a program's ordered dance lineup, via
// its junction table. Aggregated as a JSON array of {programDanceId, order,
// title} objects (not just titles) so the order survives the round trip
// through SQLite's json_group_array/json_object and back out via
// JSON.parse below.
// "order" is quoted throughout - it's a SQLite reserved word, and is also
// the actual programs_dances column name.
//
// programDanceId is the junction row's own primary key, not a business
// field - unlike order, it's guaranteed unique even against legacy data
// that predates this app (some real programs have more than one dance
// sharing the same order value, e.g. a leftover 0), so it's the one safe
// choice for a React list key here.
function programDancesSubquery(): string {
  return `
    (
      SELECT json_group_array(json_object('programDanceId', id, 'order', "order", 'title', title))
      FROM (
        SELECT programs_dances.id AS id, programs_dances."order" AS "order", dances.title AS title
        FROM programs_dances
        JOIN dances ON dances.id = programs_dances.dance_id
        WHERE programs_dances.program_id = programs.id
        ORDER BY programs_dances."order"
      )
    )
  `
}

const PROGRAMS_QUERY = `
  SELECT
    programs.id, programs.date, programs.location, programs.notes,
    programs.created_at, programs.updated_at,
    ${programDancesSubquery()} AS dances
  FROM programs
  ORDER BY programs.date DESC
`

// The shape of a row as it comes back from PROGRAMS_QUERY, before the
// dances column is JSON.parse'd into a real array below.
type ProgramQueryRow = Program & { dances: string }

export function usePrograms(): { programs: ProgramWithJoins[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `programs`,
  // `programs_dances`, or `dances` tables change.
  const { data: rawPrograms, isLoading } = useQuery<ProgramQueryRow>(PROGRAMS_QUERY)

  // Parsed once here rather than in each cell renderer. No useMemo needed -
  // React Compiler auto-memoizes this the same way, keyed on rawPrograms.
  const programs: ProgramWithJoins[] = rawPrograms.map((p) => ({
    ...p,
    dances: JSON.parse(p.dances) as ProgramWithJoins['dances'],
  }))

  return { programs, isLoading }
}
