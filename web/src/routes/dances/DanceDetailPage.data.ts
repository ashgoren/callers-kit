import { useQuery } from '@powersync/react'
import { parseNullableJsonArray } from '@/lib/powersync/json'
import { danceSelectColumns, parseDanceRow } from './DancesPage.data'
import type { FigureItem } from '@/lib/figures'
import type { DanceQueryRow } from './DancesPage.data'
import type { DanceWithJoins } from './DancesPage.columns'

// figures/calling_figures are added on top of danceSelectColumns() rather
// than folded into it, since the table/card list never renders them - only
// this single-dance query needs them.
const DANCE_QUERY = `
  SELECT ${danceSelectColumns()}, dances.figures, dances.calling_figures
  FROM dances
  WHERE dances.id = ?
`

type DanceDetailQueryRow = DanceQueryRow & { figures: string; calling_figures: string | null }

export interface DanceDetail extends DanceWithJoins {
  figures: FigureItem[]
  calling_figures: FigureItem[] | null
}

// Shared by useDance's success and (once one exists) any other consumer of
// a single dance's full row, so the figures/calling_figures parsing has one
// definition rather than living inline in the hook body.
function parseDanceDetailRow(row: DanceDetailQueryRow): DanceDetail {
  return {
    ...parseDanceRow(row),
    figures: JSON.parse(row.figures) as FigureItem[],
    calling_figures: parseNullableJsonArray<FigureItem>(row.calling_figures),
  }
}

export function useDance(id: string): { dance: DanceDetail | null; isLoading: boolean } {
  // Reactive, same as useDances() - re-runs whenever this dance's own row,
  // or any of its joined choreographers/key_moves/vibes/programs, change.
  const { data: rows, isLoading } = useQuery<DanceDetailQueryRow>(DANCE_QUERY, [id])
  const row = rows[0]

  return { dance: row ? parseDanceDetailRow(row) : null, isLoading }
}
