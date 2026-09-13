import { Link, useParams } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { useDance } from './DanceDetailPage.data'
import { danceMetadataFields, danceWideFields } from './DanceDetailPage.fields'

export function DanceDetailPage() {
  const { id } = useParams()
  const { dance, isLoading } = useDance(id ?? '')

  if (isLoading) return <PageSpinner />

  return (
    <div className="mx-auto max-w-4xl p-4">
      <Link to="/dances" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dances
      </Link>

      {!dance ? (
        <p className="mt-4 text-sm text-muted-foreground">Dance not found.</p>
      ) : (
        <>
          <div className="mt-2 border-b pb-4">
            <h1 className="text-2xl font-semibold">{dance.title || mutedPlaceholder}</h1>
            {dance.choreographers.length > 0 && (
              <p className="mt-0.5 text-sm text-muted-foreground">by {sortAlphabetically(dance.choreographers).join(', ')}</p>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_20rem]">
            <FieldList fields={danceWideFields} row={dance} className="order-2 space-y-4 sm:order-1" />
            <FieldList fields={danceMetadataFields} row={dance} className="order-1 space-y-4 sm:order-2" />
          </div>
        </>
      )}
    </div>
  )
}
