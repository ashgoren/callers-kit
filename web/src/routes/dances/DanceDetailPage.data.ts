import { useQuery } from '@powersync/react'
import { danceSelectColumns, parseDanceRow } from './DancesPage.data'
import type { DanceVersion } from '@/lib/figures'
import type { DanceQueryRow } from './DancesPage.data'
import type { DanceWithJoins } from './DancesPage.columns'

// The full versions array is added on top of danceSelectColumns() rather
// than folded into it, since the table/card list only ever needs the
// primary version's notes (already extracted there as "notes") - only this
// single-dance query needs every version's own figures/notes.
const DANCE_QUERY = `
  SELECT ${danceSelectColumns()}, dances.versions
  FROM dances
  WHERE dances.id = ?
`

type DanceDetailQueryRow = DanceQueryRow & { versions: string }

export interface DanceDetail extends DanceWithJoins {
  versions: DanceVersion[]
}

// Shared by useDance's success and (once one exists) any other consumer of
// a single dance's full row, so the versions parsing has one definition
// rather than living inline in the hook body.
function parseDanceDetailRow(row: DanceDetailQueryRow): DanceDetail {
  return {
    ...parseDanceRow(row),
    versions: JSON.parse(row.versions) as DanceVersion[],
  }
}

export function useDance(id: string): { dance: DanceDetail | null; isLoading: boolean } {
  // Reactive, same as useDances() - re-runs whenever this dance's own row,
  // or any of its joined choreographers/key_moves/vibes/programs, change.
  const { data: rows, isLoading } = useQuery<DanceDetailQueryRow>(DANCE_QUERY, [id])
  const row = rows[0]

  return { dance: row ? parseDanceDetailRow(row) : null, isLoading }
}
