import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { EditableRichText } from '@/components/fields/EditableRichText'
import { EditableText } from '@/components/fields/EditableText'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { formatDate, sortAlphabetically } from '@/lib/format'
import { makeFiguresLabel } from './DancesPage.columns'
import { useDance } from './DanceDetailPage.data'
import { danceMetadataFields } from './DanceDetailPage.fields'
import { FiguresList } from './FiguresList'
import type { DanceWithJoins } from './DancesPage.columns'

const titleSchema = z.string().min(1, 'Title is required')

export function DanceDetailPage() {
  const { id, versionId } = useParams()
  const navigate = useNavigate()
  const { dance, isLoading } = useDance(id ?? '')

  if (isLoading) return <PageSpinner />

  const figuresLabel = dance ? makeFiguresLabel(dance) : ''
  const selectedVersion = dance?.versions.find((version) => version.id === versionId) ?? dance?.versions[0]

  return (
    <div className="mx-auto max-w-6xl p-4">
      {!dance ? (
        <p className="text-sm text-muted-foreground">Dance not found.</p>
      ) : (
        <>
          <div className="border-b pb-4">
            <EditableText
              value={dance.title ?? ''}
              onCommit={(value) => void commitFieldEdit('dances', dance.id, 'title', value)}
              schema={titleSchema}
              placeholder="Untitled"
              as="h1"
              className="font-semibold text-4xl md:text-4xl"
              // Extra md:text-4xl needed for edit mode since Input has default text-sm className.
            />
            {dance.choreographers.length > 0 && (
              // pl-3.25: lines up with the title + its padding + its invisible border.
              <p className="mt-1 pl-3.25 text-base text-muted-foreground">
                by {sortAlphabetically(dance.choreographers).join(', ')}
              </p>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-[3fr_1fr]">
            <div>
              {dance.versions.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {dance.versions.map((version) => (
                    <Button
                      key={version.id}
                      variant={selectedVersion?.id === version.id ? 'secondary' : 'ghost'}
                      size="sm"
                      aria-pressed={selectedVersion?.id === version.id}
                      onClick={() => void navigate(`/dances/${dance.id}/versions/${version.id}`)}
                    >
                      {version.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-4">
                    {figuresLabel && (
                      <p className={figuresLabel === 'Improper' ? 'text-base text-muted-foreground' : 'text-base font-semibold'}>
                        {figuresLabel}
                      </p>
                    )}
                    <FiguresList items={selectedVersion?.figures ?? []} />
                  </div>
                  {selectedVersion && (
                    <Link
                      to={
                        selectedVersion.id === dance.versions[0]?.id
                          ? `/dances/${dance.id}/walkthrough`
                          : `/dances/${dance.id}/versions/${selectedVersion.id}/walkthrough`
                      }
                      className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline-offset-4 hover:underline"
                    >
                      Walkthrough
                    </Link>
                  )}
                </div>
                {selectedVersion && (
                  <div className="mt-12">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
                    <div className="mt-1">
                      <EditableRichText
                        // Keyed by version id so switching versions fully remounts this field.
                        key={selectedVersion.id}
                        value={selectedVersion.notes}
                        onCommit={(value) => void commitFieldEdit('dance_versions', selectedVersion.id, 'notes', value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <FieldList<DanceWithJoins> fields={danceMetadataFields} row={dance} className="space-y-6" />
              <div className="space-y-1 border-t pt-4 text-sm text-muted-foreground">
                <p>Added {formatDate(dance.created_at)}</p>
                <p>Edited {formatDate(dance.updated_at)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
