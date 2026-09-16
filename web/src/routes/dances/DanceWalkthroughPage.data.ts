import { useQuery } from '@powersync/react'
import { tagListSubquery } from './DancesPage.data'

// Shared by both query variants below - joined to dances for its title/
// choreographers/dance_type/formation/progression. version_count (every
// version of this same dance, not just this one) decides whether the
// version label is worth showing at all - a single-version dance has
// nothing to disambiguate.
function versionWalkthroughColumns(): string {
  return `
    dance_versions.id, dance_versions."order", dance_versions.label, dance_versions.walkthrough,
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
  SELECT ${versionWalkthroughColumns()}
  FROM dance_versions
  JOIN dances ON dances.id = dance_versions.dance_id
  WHERE dance_versions.id = ?
`

// When the URL omits a version (/dances/:id/walkthrough), falls back to the
// dance's primary (lowest-order) version - the same "no version specified,
// use the primary one" convention DanceDetailPage's own route uses.
const DANCE_VERSION_BY_DANCE_QUERY = `
  SELECT ${versionWalkthroughColumns()}
  FROM dance_versions
  JOIN dances ON dances.id = dance_versions.dance_id
  WHERE dance_versions.dance_id = ?
  ORDER BY dance_versions."order"
  LIMIT 1
`

interface DanceVersionWalkthroughRow {
  id: string
  order: number
  label: string
  walkthrough: string | null
  dance_id: string
  dance_title: string | null
  dance_type: string | null
  formation: string | null
  progression: string | null
  choreographers: string
  version_count: number
}

export interface DanceVersionWalkthrough {
  id: string
  order: number
  label: string
  walkthrough: string | null
  dance_id: string
  dance_title: string | null
  dance_type: string | null
  formation: string | null
  progression: string | null
  choreographers: string[]
  version_count: number
}

export function useDanceVersionWalkthrough({ danceId, versionId }: { danceId: string; versionId?: string }): {
  version: DanceVersionWalkthrough | null
  isLoading: boolean
} {
  const query = versionId ? DANCE_VERSION_BY_ID_QUERY : DANCE_VERSION_BY_DANCE_QUERY
  const params = versionId ? [versionId] : [danceId]
  const { data: rows, isLoading } = useQuery<DanceVersionWalkthroughRow>(query, params)
  const row = rows[0]

  return {
    version: row ? { ...row, choreographers: JSON.parse(row.choreographers) as string[] } : null,
    isLoading,
  }
}
