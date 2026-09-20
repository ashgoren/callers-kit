import { Fragment } from 'react'
import { danceFields } from './DancesPage.columns'
import type { DanceWithJoins } from './dance'

// Used by DanceCard below to look up a field's label/render given its key.
function getDanceField(key: string) {
  return danceFields.find((field) => field.key === key)
}

// Derives its fields from the same danceFields array the table columns use.
export function DanceCard({ dance }: { dance: DanceWithJoins }) {
  const titleField = getDanceField('title')!

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{titleField.render(dance.title)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {danceFields
          .filter((field) => field.key !== 'title')
          .map((field) => (
            <Fragment key={field.key}>
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0">{(field.cardRender ?? field.render)(dance[field.key])}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  )
}
