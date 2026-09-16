import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import type { DanceVersion } from '@/lib/figures'

// A dance's versions are stored as one JSONB array, not a normalized
// table - each version's figures/notes are always read and edited through
// their owning dance, never independently, so editing one version's notes
// means reading the current array, updating just that version's notes,
// and writing the whole array back.
export function commitVersionNotes(
  danceId: string,
  versions: DanceVersion[],
  versionId: string,
  notes: string | null,
): Promise<void> {
  const updatedVersions = versions.map((version) => (version.id === versionId ? { ...version, notes } : version))
  return commitFieldEdit('dances', danceId, 'versions', JSON.stringify(updatedVersions))
}
