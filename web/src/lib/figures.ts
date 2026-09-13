// A dance's choreography (the `figures` column) and its optional separate
// calling script (`calling_figures`) are both encoded as this same shape -
// an ordered list mixing two kinds of entry: a `figure` (a move tied to a
// phrase/section like "A1" and an optional beat count) and a `note` (a
// freeform annotation with no phrase/beats of its own, interspersed between
// figures). `description`/`text` are HTML - the eventual Tiptap-based editor
// for this field authors real rich text, not plain strings.
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
