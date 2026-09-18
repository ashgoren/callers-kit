import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import type { CuesData } from '@/lib/cues'

// A version's cues are one JSONB blob (cells + separators + notes), not a
// normalized table - editing any one part means reading the current value,
// updating just that part, and writing the whole blob back. Collapses to
// null (rather than a blob of empty parts) once nothing is left, so an
// untouched or fully-cleared cue sheet reads as "nothing recorded" the same
// way a null value did to begin with.
function writeCues(
  versionId: string,
  cells: Record<string, string>,
  separators: string[],
  notes: string | undefined,
): Promise<void> {
  const isEmpty = Object.keys(cells).length === 0 && separators.length === 0 && !notes
  if (isEmpty) return commitFieldEdit('dance_versions', versionId, 'cues', null)

  const next: CuesData = {
    cells,
    ...(separators.length > 0 && { separators }),
    ...(notes && { notes }),
  }
  return commitFieldEdit('dance_versions', versionId, 'cues', JSON.stringify(next))
}

export function commitCueCellEdit(versionId: string, cues: CuesData | null, key: string, value: string | null): Promise<void> {
  const cells = { ...(cues?.cells ?? {}) }
  if (value) cells[key] = value
  else delete cells[key]
  return writeCues(versionId, cells, cues?.separators ?? [], cues?.notes)
}

export function commitCueSeparatorToggle(versionId: string, cues: CuesData | null, key: string): Promise<void> {
  const separators = new Set(cues?.separators ?? [])
  if (separators.has(key)) separators.delete(key)
  else separators.add(key)
  return writeCues(versionId, cues?.cells ?? {}, [...separators], cues?.notes)
}

export function commitCueNotesEdit(versionId: string, cues: CuesData | null, value: string | null): Promise<void> {
  return writeCues(versionId, cues?.cells ?? {}, cues?.separators ?? [], value ?? undefined)
}
