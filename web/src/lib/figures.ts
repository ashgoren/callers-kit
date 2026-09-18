import { beatsRemainingInSpan, computePhraseLabel } from './phraseSkeleton'
import type { CuesData } from './cues'
import type { PhraseSpan } from './phraseSkeleton'

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
  cues: CuesData | null
  manual_phrasing: boolean
}

// Patches one item by id, leaving every other item untouched. Callers only
// ever pass fields matching that item's own kind (description/phrase/beats
// for a figure, text for a note) even though the patch type itself doesn't
// enforce that - the two kinds share no fields, so there's no real risk of
// a figure's patch silently landing on a note or vice versa.
export function updateFigureItem(
  items: FigureItem[],
  itemId: string,
  patch: Partial<FigureEntry> | Partial<NoteEntry>,
): FigureItem[] {
  return items.map((item) => (item.id === itemId ? ({ ...item, ...patch } as FigureItem) : item))
}

export function removeFigureItem(items: FigureItem[], itemId: string): FigureItem[] {
  return items.filter((item) => item.id !== itemId)
}

// Appends a new figure, prefilling phrase/beats as a starting guess from
// the skeleton (the beats remaining in whichever span the dance's existing
// figures run up to) when one applies - null/inherited otherwise. Both
// stay freely editable immediately after; this is only ever a convenience
// default, never enforced. The guessed phrase is stored even when a
// skeleton is active and the value goes unused while auto-computed - so a
// version later switched to manual phrasing starts from a reasonable value
// instead of a blank field.
export function appendFigure(items: FigureItem[], skeleton: PhraseSpan[] | null): FigureItem[] {
  const priorFigures = items.filter(isFigureEntry)
  const cumulativeBeats = priorFigures.reduce((sum, item) => sum + (item.beats ?? 0), 0)
  const phrase = skeleton ? computePhraseLabel(cumulativeBeats, skeleton) : (priorFigures.at(-1)?.phrase ?? '')
  const beats = skeleton ? beatsRemainingInSpan(cumulativeBeats, skeleton) : null
  return [...items, { id: crypto.randomUUID(), kind: 'figure', phrase, beats, description: '' }]
}

export function appendNote(items: FigureItem[]): FigureItem[] {
  return [...items, { id: crypto.randomUUID(), kind: 'note', text: '' }]
}
