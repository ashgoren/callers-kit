// A dance version's figures list mixes two kinds of entry: a `figure` (a
// move tied to a phrase/section like "A1" and an optional beat count) and a
// `note` (a freeform annotation with no phrase/beats of its own, interspersed
// between figures). `description`/`text` are HTML - the eventual Tiptap-based
// editor for this field authors real rich text, not plain strings.
export interface FigureEntry {
  id: string
  kind: 'figure'
  phrase: string
  beats: number | null
  description: string
}

export interface NoteEntry {
  id: string
  kind: 'note'
  text: string
}

export type FigureItem = FigureEntry | NoteEntry

export function isFigureEntry(item: FigureItem): item is FigureEntry {
  return item.kind === 'figure'
}

// A dance can have more than one version of "how to call it" - e.g. a
// standard version and a separate calling script, or versions for different
// skill levels - each a self-contained figures list plus its own notes. The
// first entry in a dance's versions array is always its primary version.
export interface DanceVersion {
  id: string
  label: string
  figures: FigureItem[]
  notes: string | null
}
