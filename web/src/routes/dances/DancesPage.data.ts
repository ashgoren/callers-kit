import { useQuery } from '@powersync/react'
import type { Dance } from '@/lib/powersync/schema'
import type { ProgramSummary } from '@/routes/programs/ProgramsPage.columns'
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

// Builds correlated subquery for a dance's program history, via programs_dances.
// Aggregated as {id, date, location} objects, most-recent-first, since
// that's the order the Programs column itself sorts by. id (the program's
// own row id) is included so each entry has a stable React key - date+
// location alone isn't guaranteed unique (e.g. two different programs at
// the same hall on the same date).
function dancesProgramsSubquery(): string {
  return `
    (
      SELECT json_group_array(json_object('id', id, 'date', date, 'location', location))
      FROM (
        SELECT programs.id AS id, programs.date AS date, programs.location AS location
        FROM programs_dances
        JOIN programs ON programs.id = programs_dances.program_id
        WHERE programs_dances.dance_id = dances.id
        ORDER BY programs.date DESC
      )
    )
  `
}

// The SELECT column list shared by the dances list query and a single
// dance's detail-page query - each caller supplies its own FROM/WHERE/ORDER
// BY around this.
export function danceSelectColumns(): string {
  return `
    dances.id, dances.title, dances.difficulty, dances.dance_type, dances.formation, dances.progression,
    dances.created_at, dances.updated_at,
    -- The primary (first) version's notes stand in for "this dance's notes"
    -- here - the table/card list has no way to show more than one version's
    -- worth, and the full versions array is detail-page-only.
    json_extract(dances.versions, '$[0].notes') AS notes,
    ${tagListSubquery('dances_choreographers', 'choreographers', 'choreographer_id')} AS choreographers,
    ${tagListSubquery('dances_key_moves', 'key_moves', 'key_move_id')} AS key_moves,
    ${tagListSubquery('dances_vibes', 'vibes', 'vibe_id')} AS vibes,
    ${dancesProgramsSubquery()} AS programs
  `
}

const DANCES_QUERY = `
  SELECT ${danceSelectColumns()}
  FROM dances
  ORDER BY dances.title
`

// The shape of a row as it comes back from either query above, before the
// tag-list/program-history columns are JSON.parse'd into real arrays below.
// Omits versions (danceSelectColumns() extracts just its primary notes,
// aliased back to "notes" - see above) and adds that extracted value back.
export type DanceQueryRow = Omit<Dance, 'versions'> & {
  notes: string | null
  choreographers: string
  key_moves: string
  vibes: string
  programs: string
}

// Shared by both the list and detail-page hooks, so they can't drift apart.
export function parseDanceRow(d: DanceQueryRow): DanceWithJoins {
  return {
    ...d,
    choreographers: JSON.parse(d.choreographers) as string[],
    key_moves: JSON.parse(d.key_moves) as string[],
    vibes: JSON.parse(d.vibes) as string[],
    programs: JSON.parse(d.programs) as ProgramSummary[],
  }
}

export function useDances(): { dances: DanceWithJoins[]; isLoading: boolean } {
  // Reactive: auto re-runs & re-renders whenever local SQLite `dances`,
  // `dances_choreographers`/`choreographers`, `dances_key_moves`/`key_moves`,
  // `dances_vibes`/`vibes`, or `programs_dances`/`programs` tables change.
  const { data: rawDances, isLoading } = useQuery<DanceQueryRow>(DANCES_QUERY)

  // Parsed once here rather than in each cell renderer. No useMemo needed -
  // React Compiler auto-memoizes this the same way, keyed on rawDances.
  const dances: DanceWithJoins[] = rawDances.map(parseDanceRow)

  return { dances, isLoading }
}
