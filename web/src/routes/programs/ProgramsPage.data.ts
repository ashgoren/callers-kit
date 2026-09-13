import { useQuery } from '@powersync/react'
import type { Program } from '@/lib/powersync/schema'
import type { ProgramWithJoins } from './ProgramsPage.columns'

// Builds the correlated subquery for a program's ordered dance lineup, via
// its junction table. Aggregated as a JSON array of {programDanceId,
// danceId, order, title} objects so the order survives the round trip
// through SQLite's json_group_array/json_object and back out via
// JSON.parse below.
// "order" is quoted throughout - it's a SQLite reserved word, and is also
// the actual programs_dances column name.
//
// programDanceId is the junction row's own primary key, not a business
// field - unlike order, it's guaranteed unique even against legacy data
// that predates this app (some real programs have more than one dance
// sharing the same order value, e.g. a leftover 0), so it's the one safe
// choice for a React list key here. danceId (the dance's own id, not used
// by the table view today) is included so a future reorder/remove UI can
// act on a specific lineup entry without another query change.
function programDancesSubquery(): string {
  return `
    (
      SELECT json_group_array(json_object('programDanceId', id, 'danceId', dance_id, 'order', "order", 'title', title))
      FROM (
        SELECT programs_dances.id AS id, programs_dances.dance_id AS dance_id, programs_dances."order" AS "order", dances.title AS title
        FROM programs_dances
        JOIN dances ON dances.id = programs_dances.dance_id
        WHERE programs_dances.program_id = programs.id
        ORDER BY programs_dances."order"
      )
    )
  `
}

// The SELECT column list shared by the programs list query and a single
// program's detail-page query - each caller supplies its own FROM/WHERE/
// ORDER BY around this.
export function programSelectColumns(): string {
  return `
    programs.id, programs.date, programs.location, programs.notes,
    programs.created_at, programs.updated_at,
    ${programDancesSubquery()} AS dances
  `
}

const PROGRAMS_QUERY = `
  SELECT ${programSelectColumns()}
  FROM programs
  ORDER BY programs.date DESC
`

// The shape of a row as it comes back from either query above, before the
// dances column is JSON.parse'd into a real array below.
export type ProgramQueryRow = Program & { dances: string }

// Shared by both the list and detail-page hooks, so they can't drift apart.
export function parseProgramRow(p: ProgramQueryRow): ProgramWithJoins {
  return {
    ...p,
    dances: JSON.parse(p.dances) as ProgramWithJoins['dances'],
  }
}

export function usePrograms(): { programs: ProgramWithJoins[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `programs`,
  // `programs_dances`, or `dances` tables change.
  const { data: rawPrograms, isLoading } = useQuery<ProgramQueryRow>(PROGRAMS_QUERY)

  // Parsed once here rather than in each cell renderer. No useMemo needed -
  // React Compiler auto-memoizes this the same way, keyed on rawPrograms.
  const programs: ProgramWithJoins[] = rawPrograms.map(parseProgramRow)

  return { programs, isLoading }
}
