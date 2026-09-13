import { useQuery } from '@powersync/react'
import { danceSelectColumns, parseDanceRow } from './DancesPage.data'
import type { DanceQueryRow } from './DancesPage.data'
import type { DanceWithJoins } from './DancesPage.columns'

const DANCE_QUERY = `
  SELECT ${danceSelectColumns()}
  FROM dances
  WHERE dances.id = ?
`

export function useDance(id: string): { dance: DanceWithJoins | null; isLoading: boolean } {
  // Reactive, same as useDances() - re-runs whenever this dance's own row,
  // or any of its joined choreographers/key_moves/vibes/programs, change.
  const { data: rows, isLoading } = useQuery<DanceQueryRow>(DANCE_QUERY, [id])

  return { dance: rows[0] ? parseDanceRow(rows[0]) : null, isLoading }
}
