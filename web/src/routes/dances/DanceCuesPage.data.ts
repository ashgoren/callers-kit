import { useQuery } from '@powersync/react'
import { tagListSubquery } from './DancesPage.data'
import type { CuesData } from '@/lib/cues'
import type { TagOption } from './DancesPage.data'

// Shared by both query variants below - same joined metadata as
// DanceWalkthroughPage.data.ts, swapping walkthrough for cues. cues is a
// plain TEXT column locally (see schema.ts's jsonColumn()) holding raw JSON,
// so it's selected the same way walkthrough is - no json(...) wrapping is
// needed here the way DanceDetailPage.data.ts needs it for figures/cues
// nested inside its own json_object(...) call; this query selects the
// column directly, not as a value embedded inside another JSON structure.
function versionCuesColumns(): string {
  return `
    dance_versions.id, dance_versions."order", dance_versions.label, dance_versions.cues,
    dances.id AS dance_id, dances.title AS dance_title,
    dances.dance_type, dances.formation, dances.progression,
    ${tagListSubquery('dances_choreographers', 'choreographers', 'choreographer_id')} AS choreographers,
    (SELECT COUNT(*) FROM dance_versions WHERE dance_versions.dance_id = dances.id) AS version_count
  `
}

// Looked up directly by its own id when the URL names a specific version
// (a real, double-checkable link - not trusting the dance's own :id segment
// alone, since this page is reachable by a direct link too).
const DANCE_VERSION_BY_ID_QUERY = `
  SELECT ${versionCuesColumns()}
  FROM dance_versions
  JOIN dances ON dances.id = dance_versions.dance_id
  WHERE dance_versions.id = ?
`

// When the URL omits a version (/dances/:id/cues), falls back to the
// dance's primary (lowest-order) version - the same "no version specified,
// use the primary one" convention DanceWalkthroughPage's own route uses.
const DANCE_VERSION_BY_DANCE_QUERY = `
  SELECT ${versionCuesColumns()}
  FROM dance_versions
  JOIN dances ON dances.id = dance_versions.dance_id
  WHERE dance_versions.dance_id = ?
  ORDER BY dance_versions."order"
  LIMIT 1
`

interface DanceVersionCuesRow {
  id: string
  order: number
  label: string
  cues: string | null
  dance_id: string
  dance_title: string | null
  dance_type: string | null
  formation: string | null
  progression: string | null
  choreographers: string
  version_count: number
}

export interface DanceVersionCues {
  id: string
  order: number
  label: string
  cues: CuesData | null
  dance_id: string
  dance_title: string | null
  dance_type: string | null
  formation: string | null
  progression: string | null
  choreographers: TagOption[]
  version_count: number
}

export function useDanceVersionCues({ danceId, versionId }: { danceId: string; versionId?: string }): {
  version: DanceVersionCues | null
  isLoading: boolean
} {
  const query = versionId ? DANCE_VERSION_BY_ID_QUERY : DANCE_VERSION_BY_DANCE_QUERY
  const params = versionId ? [versionId] : [danceId]
  const { data: rows, isLoading } = useQuery<DanceVersionCuesRow>(query, params)
  const row = rows[0]

  return {
    version: row
      ? { ...row, cues: row.cues ? (JSON.parse(row.cues) as CuesData) : null, choreographers: JSON.parse(row.choreographers) as TagOption[] }
      : null,
    isLoading,
  }
}
