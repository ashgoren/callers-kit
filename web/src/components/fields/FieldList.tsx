import type { DetailField } from './DetailField'

// Renders a list of DetailFields as label-above/value-below blocks - the one
// rendering treatment every DetailField shares, regardless of which column
// (or how many columns) a particular detail page lays them out into.
export function FieldList<TRow>({
  fields,
  row,
  className,
}: {
  fields: DetailField<TRow>[]
  row: TRow
  className?: string
}) {
  return (
    <dl className={className}>
      {fields.map((field) => (
        <div key={String(field.key)}>
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{field.label}</dt>
          <dd className="mt-1 text-sm">{field.render(row[field.key])}</dd>
        </div>
      ))}
    </dl>
  )
}
