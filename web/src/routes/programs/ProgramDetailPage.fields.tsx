import { cardRenderDanceList } from './ProgramsPage.columns'
import { makeDetailFieldDefiner } from '@/components/fields/DetailField'
import { mutedPlaceholder } from '@/lib/format'
import type { DetailField } from '@/components/fields/DetailField'
import type { ProgramWithJoins } from './ProgramsPage.columns'

const defineField = makeDetailFieldDefiner<ProgramWithJoins>()

export const programDetailFields: DetailField<ProgramWithJoins>[] = [
  defineField({ key: 'dances', label: 'Dances', render: cardRenderDanceList }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => (value ? <p className="whitespace-pre-wrap">{value}</p> : mutedPlaceholder),
  }),
]
