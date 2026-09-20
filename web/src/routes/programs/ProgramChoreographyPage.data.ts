import { useQuery } from '@powersync/react'
import { tagListSubquery } from '@/routes/dances/DancesPage.data'
import type { ChoreographyDance } from '@/lib/choreographyPhrases'
import type { FigureItem } from '@/lib/figures'
import type { TagOption } from '@/routes/dances/DancesPage.data'

// Everything buildChoreographyRows needs (via ChoreographyDance) plus the
// extra fields this page's own header row shows per dance.
export interface ProgramChoreographyDance extends ChoreographyDance {
  order: number
  formation: string | null
  progression: string | null
  keyMoves: TagOption[]
}

// Each dance's primary version only.
const PROGRAM_CHOREOGRAPHY_QUERY = `
  SELECT
    dances.id AS dance_id, dances.title AS title, programs_dances."order" AS "order",
    dances.dance_type AS dance_type, dances.formation AS formation, dances.progression AS progression,
    dance_versions.figures AS figures, dance_versions.manual_phrasing AS manual_phrasing,
    ${tagListSubquery('dances_key_moves', 'key_moves', 'key_move_id')} AS key_moves
  FROM programs_dances
  JOIN dances ON dances.id = programs_dances.dance_id
  LEFT JOIN dance_versions ON dance_versions.id = (
    SELECT id FROM dance_versions WHERE dance_versions.dance_id = dances.id ORDER BY "order" LIMIT 1
  )
  WHERE programs_dances.program_id = ?
  ORDER BY programs_dances."order"
`

interface ProgramChoreographyRow {
  dance_id: string
  title: string
  order: number
  dance_type: string | null
  formation: string | null
  progression: string | null
  figures: string | null
  manual_phrasing: number | null
  key_moves: string
}

export function useProgramChoreographyDances(programId: string): { dances: ProgramChoreographyDance[]; isLoading: boolean } {
  const { data: rows, isLoading } = useQuery<ProgramChoreographyRow>(PROGRAM_CHOREOGRAPHY_QUERY, [programId])

  const dances: ProgramChoreographyDance[] = rows.map((row) => ({
    danceId: row.dance_id,
    title: row.title,
    order: row.order,
    danceType: row.dance_type,
    formation: row.formation,
    progression: row.progression,
    manualPhrasing: row.manual_phrasing === 1,
    figures: row.figures ? (JSON.parse(row.figures) as FigureItem[]) : [],
    keyMoves: JSON.parse(row.key_moves) as TagOption[],
  }))

  return { dances, isLoading }
}
