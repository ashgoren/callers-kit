import { useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { EditableText } from '@/components/fields/EditableText'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { formatFormation } from './DancesPage.columns'
import { useDance } from './DanceDetailPage.data'
import { danceMetadataFields } from './DanceDetailPage.fields'
import { FiguresList } from './FiguresList'
import type { DanceWithJoins } from './DancesPage.columns'

const titleSchema = z.string().min(1, 'Title is required')

function makeFiguresLabel(dance: DanceWithJoins): string {
  return [
    dance.dance_type && dance.dance_type.toLowerCase() !== 'contra' ? dance.dance_type : null,
    dance.formation ? formatFormation(dance.formation) : null,
    dance.progression && dance.progression.toLowerCase() !== 'single' ? `${dance.progression} progression` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function DanceDetailPage() {
  const { id } = useParams()
  const { dance, isLoading } = useDance(id ?? '')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)

  if (isLoading) return <PageSpinner />

  const figuresLabel = dance ? makeFiguresLabel(dance) : ''
  const selectedVersion = dance?.versions.find((version) => version.id === selectedVersionId) ?? dance?.versions[0]

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
                      onClick={() => setSelectedVersionId(version.id)}
                    >
                      {version.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="rounded-lg border p-4">
                <div className="space-y-4">
                  {figuresLabel && (
                    <p className={figuresLabel === 'Improper' ? 'text-base text-muted-foreground' : 'text-base font-semibold'}>
                      {figuresLabel}
                    </p>
                  )}
                  <FiguresList items={selectedVersion?.figures ?? []} />
                </div>
                {selectedVersion && (
                  <div className="mt-12">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
                    <div className="mt-1">
                      {selectedVersion.notes ? <p className="whitespace-pre-wrap">{selectedVersion.notes}</p> : mutedPlaceholder}
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
