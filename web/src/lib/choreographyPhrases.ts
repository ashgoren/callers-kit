import { isFigureEntry, withComputedPhrases } from './figures'
import { getDefaultSkeleton } from './phraseSkeleton'
import type { FigureEntry, FigureItem } from './figures'

// One dance's worth of input this module needs - a subset of DanceVersion
// (see figures.ts) plus the parent dance's own dance_type.
export interface ChoreographyDance {
  danceId: string
  title: string
  danceType: string | null
  manualPhrasing: boolean
  figures: FigureItem[]
}

export interface ChoreographyRow {
  phrase: string
  // figuresByDance[i] is danceId dances[i]'s figures for this row's phrase.
  figuresByDance: FigureEntry[][]
}

// Groups each dance's figures by the phrase they display under - the same
// derived-not-stored computation FiguresList uses for a single dance (see
// phraseSkeleton.ts) - then unions the phrase labels seen across every
// dance into one ordered row list, so dances can be compared phrase-by-
// phrase side by side.
//
// Row order is first-encountered, scanning dances in lineup order and each
// dance's own figures in their own order.
export function buildChoreographyRows(dances: ChoreographyDance[]): ChoreographyRow[] {
  const figuresByPhrasePerDance = dances.map(({ figures, danceType, manualPhrasing }) => {
    const skeleton = manualPhrasing ? null : getDefaultSkeleton(danceType)
    const grouped = new Map<string, FigureEntry[]>()
    for (const { item, phrase } of withComputedPhrases(figures, skeleton)) {
      if (!isFigureEntry(item) || phrase === null) continue
      const existing = grouped.get(phrase)
      if (existing) {
        existing.push(item)
      } else {
        grouped.set(phrase, [item])
      }
    }
    return grouped
  })

  const phrases: string[] = []
  for (const grouped of figuresByPhrasePerDance) {
    for (const phrase of grouped.keys()) {
      if (!phrases.includes(phrase)) phrases.push(phrase)
    }
  }

  return phrases.map((phrase) => ({
    phrase,
    figuresByDance: figuresByPhrasePerDance.map((grouped) => grouped.get(phrase) ?? []),
  }))
}
