import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { isFigureEntry } from '@/lib/figures'
import type { FigureItem } from '@/lib/figures'

// A version's figures are one JSONB array, not a normalized table - editing
// one item's own text means reading the current array, updating just that
// item's own field, and writing the whole array back.
export function commitFigureItemEdit(
  versionId: string,
  figures: FigureItem[],
  itemId: string,
  value: string,
): Promise<void> {
  const updatedFigures = figures.map((item) => {
    if (item.id !== itemId) return item
    return isFigureEntry(item) ? { ...item, description: value } : { ...item, text: value }
  })
  return commitFieldEdit('dance_versions', versionId, 'figures', JSON.stringify(updatedFigures))
}
