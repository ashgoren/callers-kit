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

// A dance can have more than one version of "how to call it" -
// each a self-contained figures list, notes, walkthrough, and cue sheet.
// A dance's primary version is whichever version has the lowest order.
export interface DanceVersion {
  id: string
  order: number
  label: string
  figures: FigureItem[]
  notes: string | null
  walkthrough: string | null
  cues: unknown // TBD
}
