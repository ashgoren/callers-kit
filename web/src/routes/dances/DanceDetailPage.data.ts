import { useQuery } from '@powersync/react'
import { danceSelectColumns, parseDanceRow } from './DancesPage.data'
import type { DanceVersion } from '@/lib/figures'
import type { DanceQueryRow } from './DancesPage.data'
import type { DanceWithJoins } from './DancesPage.columns'

// Aggregates a dance's own dance_versions rows into one ordered JSON array,
// primary version first - the table/card list only ever needs the primary
// version's notes (already extracted via DancesPage.data.ts's own
// subquery), never every version's full contents, which is detail-page-only.
// figures/cues are themselves JSON-encoded text columns locally (see
// schema.ts's jsonColumn()) - json(...) marks each as already-valid JSON
// before nesting it inside json_object(), so the result comes back with
// real nested arrays/objects rather than a doubly-escaped JSON string.
function danceVersionsSubquery(): string {
  return `
    (
      SELECT json_group_array(
        json_object(
          'id', id,
          'order', "order",
          'label', label,
          'figures', json(figures),
          'notes', notes,
          'walkthrough', walkthrough,
          'cues', json(cues),
          'manual_phrasing', manual_phrasing
        )
      )
      FROM (
        SELECT id, "order", label, figures, notes, walkthrough, cues, manual_phrasing
        FROM dance_versions
        WHERE dance_versions.dance_id = dances.id
        ORDER BY dance_versions."order"
      )
    )
  `
}

const DANCE_QUERY = `
  SELECT ${danceSelectColumns()}, ${danceVersionsSubquery()} AS versions
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
  const versions = JSON.parse(row.versions) as DanceVersion[]
  return {
    ...parseDanceRow(row),
    // manual_phrasing comes back from powersync as int; coerce to boolean for the rest of the app's use.
    versions: versions.map((version) => ({ ...version, manual_phrasing: Boolean(version.manual_phrasing) })),
  }
}

export function useDance(id: string): { dance: DanceDetail | null; isLoading: boolean } {
  // Reactive, same as useDances() - re-runs whenever this dance's own row,
  // its dance_versions rows, or any of its joined choreographers/key_moves/
  // vibes/programs, change.
  const { data: rows, isLoading } = useQuery<DanceDetailQueryRow>(DANCE_QUERY, [id])
  const row = rows[0]

  return { dance: row ? parseDanceDetailRow(row) : null, isLoading }
}
