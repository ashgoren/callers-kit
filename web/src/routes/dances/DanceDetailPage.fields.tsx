import { Link } from 'react-router'
import { formatFormation } from './DancesPage.columns'
import { makeDetailFieldDefiner } from '@/components/fields/DetailField'
import { mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { formatProgramLabel } from '@/routes/programs/ProgramsPage.columns'
import type { ReactNode } from 'react'
import type { DetailField } from '@/components/fields/DetailField'
import type { DanceWithJoins } from './DancesPage.columns'

function renderChipList(values: string[]): ReactNode {
  if (values.length === 0) return mutedPlaceholder
  return (
    <div className="flex flex-wrap gap-1">
      {sortAlphabetically(values).map((value) => (
        <span key={value} className="rounded-full border bg-muted px-2 py-0.5 text-xs">
          {value}
        </span>
      ))}
    </div>
  )
}

function renderProgramHistory(value: DanceWithJoins['programs']): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return (
    <ul className="space-y-0.5">
      {value.map((program) => (
        <li key={program.id}>
          <Link to={`/programs/${program.id}`} className="hover:underline">
            {formatProgramLabel(program)}
          </Link>
        </li>
      ))}
    </ul>
  )
}

const defineField = makeDetailFieldDefiner<DanceWithJoins>()

// The narrow column's fields.
export const danceMetadataFields: DetailField<DanceWithJoins>[] = [
  defineField({ key: 'key_moves', label: 'Key Moves', render: renderChipList }),
  defineField({ key: 'vibes', label: 'Vibes', render: renderChipList }),
  defineField({ key: 'difficulty', label: 'Difficulty', render: (value) => (value === null ? mutedPlaceholder : value) }),
  defineField({ key: 'dance_type', label: 'Dance Type', render: (value) => (value === null ? mutedPlaceholder : value) }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value) => (value === null ? mutedPlaceholder : formatFormation(value)),
  }),
  defineField({ key: 'progression', label: 'Progression', render: (value) => (value === null ? mutedPlaceholder : value) }),
  defineField({ key: 'programs', label: 'Programs', render: renderProgramHistory }),
]
