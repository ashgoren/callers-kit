// A dance's "phrase skeleton" - an ordered list of labeled beat spans
// (A1/A2/B1/B2, each 16 beats, for a standard contra) that a figure's
// running beat total lands within. Phrase labels are derived from this
// rather than stored per figure, so reordering figures or editing an
// earlier one's beats can never leave a stale label sitting downstream -
// the label is always a function of the current data, not a separate copy
// of it. Only Contra has a default skeleton today. Others fall back to a
// version's own manual_phrasing toggle instead of this default.
export interface PhraseSpan {
  label: string
  beats: number
}

const CONTRA_SKELETON: PhraseSpan[] = [
  { label: 'A1', beats: 16 },
  { label: 'A2', beats: 16 },
  { label: 'B1', beats: 16 },
  { label: 'B2', beats: 16 },
]

export function getDefaultSkeleton(danceType: string | null): PhraseSpan[] | null {
  return danceType === 'Contra' ? CONTRA_SKELETON : null
}

// Which span a figure falls in, given the total beats of every figure
// before it. A dance that runs longer than its skeleton (an unusually long
// figure, or one the caller hasn't trimmed to fit yet) clamps to the last
// span rather than returning nothing.
export function computePhraseLabel(cumulativeBeats: number, skeleton: PhraseSpan[]): string {
  let offset = 0
  for (const span of skeleton) {
    if (cumulativeBeats < offset + span.beats) return span.label
    offset += span.beats
  }
  return skeleton[skeleton.length - 1].label
}

// How many beats remain in the span a new figure would land in, capped at
// one span's own length - used only to prefill a freshly-added figure's
// beats field with a reasonable starting guess.
export function beatsRemainingInSpan(cumulativeBeats: number, skeleton: PhraseSpan[]): number {
  let offset = 0
  for (const span of skeleton) {
    if (cumulativeBeats < offset + span.beats) return offset + span.beats - cumulativeBeats
    offset += span.beats
  }
  return skeleton[skeleton.length - 1].beats
}
