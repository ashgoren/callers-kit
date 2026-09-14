import type { DetailField } from './DetailField'

function FieldBlock<TRow>({ field, row }: { field: DetailField<TRow>; row: TRow }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{field.label}</dt>
      <dd className="mt-1 text-sm">{field.render(row[field.key], row)}</dd>
    </div>
  )
}

// Renders a list of DetailFields as label-above/value-below blocks - the one
// rendering treatment every DetailField shares. A field that needs different
// treatment (e.g. a compact "Label: value" line, a visual separator from the
// rest of the list) is rendered as bespoke JSX in the page itself rather than
// through this shared component.
export function FieldList<TRow>({ fields, row, className }: { fields: DetailField<TRow>[]; row: TRow; className?: string }) {
  return (
    <dl className={className}>
      {fields.map((field) => (
        <FieldBlock key={String(field.key)} field={field} row={row} />
      ))}
    </dl>
  )
}
