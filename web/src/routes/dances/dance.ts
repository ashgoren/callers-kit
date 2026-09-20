import type { Dance } from '@/lib/powersync/schema'
import type { Video } from '@/lib/videos'
import type { ProgramSummary } from '@/routes/programs/ProgramsPage.columns'
import type { TagOption } from './DancesPage.data'

// Shared across the dances list and detail pages (and anywhere else that
// needs a fully-joined dance row).
//
// notes isn't a real column on Dance - danceSelectColumns() extracts
// the primary version's own notes and aliases it back to "notes".
// videos overrides Dance's own raw JSON-text column with the parsed array
// (Omit'd rather than plain-extended, since a subtype can't narrow a
// property's type through ordinary interface extension).
export interface DanceWithJoins extends Omit<Dance, 'videos'> {
  notes: string | null
  choreographers: TagOption[]
  key_moves: TagOption[]
  vibes: TagOption[]
  programs: ProgramSummary[]
  videos: Video[]
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

// The short, combined "what kind of dance is this" label - dance_type and
// progression are only worth mentioning when they're something other than
// the overwhelmingly common case (Contra, Single progression), so most
// dances show just their formation (e.g. "Improper", "Becket").
export function makeFiguresLabel(dance: {
  dance_type: string | null
  formation: string | null
  progression: string | null
}): string {
  return [
    dance.dance_type && dance.dance_type.toLowerCase() !== 'contra' ? dance.dance_type : null,
    dance.formation ? formatFormation(dance.formation) : null,
    dance.progression && dance.progression.toLowerCase() !== 'single' ? `${dance.progression} progression` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
