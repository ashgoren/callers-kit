import { Fragment } from 'react'
import { formatProgramLabel, programFields } from './ProgramsPage.columns'
import type { ProgramWithJoins } from './ProgramsPage.columns'

// Derives its fields from the same programFields array the table columns use.
export function ProgramCard({ program }: { program: ProgramWithJoins }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{formatProgramLabel(program)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {programFields
          // date and location are already combined into the card's title
          // line above; created_at/updated_at are left off the card.
          .filter((field) => !['date', 'location', 'created_at', 'updated_at'].includes(field.key))
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
