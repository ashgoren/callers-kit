import { Link } from 'react-router'
import { z } from 'zod'
import { formatFormation } from './DancesPage.columns'
import { EditableNumber } from '@/components/fields/EditableNumber'
import { EditableSelect } from '@/components/fields/EditableSelect'
import { EditableTagCombobox } from '@/components/fields/EditableTagCombobox'
import { makeDetailFieldDefiner } from '@/components/fields/DetailField'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { mutedPlaceholder } from '@/lib/format'
import { formatProgramLabel } from '@/routes/programs/ProgramsPage.columns'
import type { ReactNode } from 'react'
import type { DetailField } from '@/components/fields/DetailField'
import type { DanceWithJoins } from './DancesPage.columns'

// Non-negative integer so difficulty stays sortable; null (unset) is also allowed.
const difficultySchema = z.number().int().min(0).nullable()

// Empty string means "not set yet".
export const urlSchema = z.url().or(z.literal(''))

// Fixed, admin-managed vocabularies - mirrors the public.dance_type/
// formation/progression enums in the Supabase schema exactly.
const DANCE_TYPES = ['Contra', 'Square', 'ECD', 'Mixer', 'Other']
const FORMATIONS = [
  'Duple Minor - Improper',
  'Duple Minor - Becket',
  'Duple Minor - Becket CCW',
  'Duple Minor',
  'Duple Minor - Proper',
  'Duple Minor - Indecent',
  'Duple Minor - Reverse progression improper',
  'Duple Minor - Progressed improper',
  'Duple Minor - Cross',
  'Duple Minor - Other',
  'Triple Minor',
  'Three Facing Three',
  'Four Facing Four',
  'Solo',
  'Singlet',
  'Doublet',
  'Triplet',
  'Quadruplet',
  'Longways: 5+ couples',
  'Other Longways',
  'Circle Mixer',
  'Circle of Threesomes',
  'Sicilian Circle',
  'Scatter Mixer',
  'Grid Contra',
  'Grid Square',
  'Zia',
  'other',
]
const PROGRESSIONS = ['Single', 'Double', 'Triple', 'None', 'Other']

// Show shortened version of url for caller's box
export function formatUrl(url: string): ReactNode {
  if (!url) return mutedPlaceholder
  const ibiblioId = /ibiblio\.org\/contradance\/thecallersbox\/dance\.php\?id=(\d+)/.exec(url)?.[1]
  return ibiblioId ? `Caller's Box ${ibiblioId}` : url
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
  defineField({
    key: 'key_moves',
    label: 'Key Moves',
    render: (value, row) => (
      <EditableTagCombobox
        danceId={row.id}
        junctionTable="dances_key_moves"
        refIdColumn="key_move_id"
        ownerTable="key_moves"
        value={value}
        placeholder="Add a key move..."
      />
    ),
  }),
  defineField({
    key: 'vibes',
    label: 'Vibes',
    render: (value, row) => (
      <EditableTagCombobox
        danceId={row.id}
        junctionTable="dances_vibes"
        refIdColumn="vibe_id"
        ownerTable="vibes"
        value={value}
        placeholder="Add a vibe..."
      />
    ),
  }),
  defineField({
    key: 'difficulty',
    label: 'Difficulty',
    render: (value, row) => (
      <EditableNumber
        value={value}
        onCommit={(v) => void commitFieldEdit('dances', row.id, 'difficulty', v)}
        schema={difficultySchema}
        min={0}
      />
    ),
  }),
  defineField({
    key: 'dance_type',
    label: 'Dance Type',
    render: (value, row) => (
      <EditableSelect
        value={value}
        onCommit={(v) => void commitFieldEdit('dances', row.id, 'dance_type', v)}
        options={DANCE_TYPES}
      />
    ),
  }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value, row) => (
      <EditableSelect
        value={value}
        onCommit={(v) => void commitFieldEdit('dances', row.id, 'formation', v)}
        options={FORMATIONS}
        formatLabel={formatFormation}
      />
    ),
  }),
  defineField({
    key: 'progression',
    label: 'Progression',
    render: (value, row) => (
      <EditableSelect
        value={value}
        onCommit={(v) => void commitFieldEdit('dances', row.id, 'progression', v)}
        options={PROGRESSIONS}
      />
    ),
  }),
]

// Videos renders its own label (with an edit pencil beside it, unlike every
// other field here) rather than going through FieldList's generic dt/dd -
// see VideosField.tsx. Programs stays a normal FieldList entry, just kept
// in its own array so it can be positioned right after Videos in the page.
export const danceProgramsFields: DetailField<DanceWithJoins>[] = [
  defineField({ key: 'programs', label: 'Programs', render: renderProgramHistory }),
]
