import { Fragment } from 'react'
import { programFields } from './ProgramsPage.columns'
import type { ProgramWithJoins } from './ProgramsPage.columns'

// Used by ProgramCard below to look up a field's label/render given its key.
function getProgramField(key: string) {
  return programFields.find((field) => field.key === key)
}

// Derives its fields from the same programFields array the table columns use.
export function ProgramCard({ program }: { program: ProgramWithJoins }) {
  const dateField = getProgramField('date')!

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{dateField.render(program.date)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {programFields
          // date is already shown above as the card's title;
          // created_at/updated_at are left off the card.
          .filter((field) => !['date', 'created_at', 'updated_at'].includes(field.key))
          .map((field) => (
            <Fragment key={field.key}>
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0">{(field.cardRender ?? field.render)(program[field.key])}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  )
}
