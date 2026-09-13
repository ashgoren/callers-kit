import { useState } from 'react'
import { useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { formatFormation } from './DancesPage.columns'
import { useDance } from './DanceDetailPage.data'
import { danceMetadataFields, danceWideFields } from './DanceDetailPage.fields'
import { FiguresList } from './FiguresList'
import type { DanceWithJoins } from './DancesPage.columns'

type FigureMode = 'choreography' | 'calling'

// Summarizes dance_type/formation/progression into one line above the
// figures list - only this page needs it, so it isn't a shared helper the
// way formatFormation is. Each part is left off when it's the common
// default (Contra, any Duple Minor formation collapses to just its variant
// name via formatFormation, Single progression) and shown otherwise, so the
// label only calls out what's actually unusual about this dance.
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
  const [figureMode, setFigureMode] = useState<FigureMode>('choreography')

  if (isLoading) return <PageSpinner />

  const figuresLabel = dance ? makeFiguresLabel(dance) : ''

  return (
    <div className="mx-auto max-w-4xl p-4">
      {!dance ? (
        <p className="text-sm text-muted-foreground">Dance not found.</p>
      ) : (
        <>
          <div className="border-b pb-4">
            <h1 className="text-4xl font-semibold">{dance.title || mutedPlaceholder}</h1>
            {dance.choreographers.length > 0 && (
              <p className="mt-1 text-base text-muted-foreground">by {sortAlphabetically(dance.choreographers).join(', ')}</p>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_20rem]">
            <div>
              <div className="space-y-4">
                {dance.calling_figures !== null && (
                  <div className="flex gap-1">
                    <Button
                      variant={figureMode === 'choreography' ? 'secondary' : 'ghost'}
                      size="sm"
                      aria-pressed={figureMode === 'choreography'}
                      onClick={() => setFigureMode('choreography')}
                    >
                      Choreography
                    </Button>
                    <Button
                      variant={figureMode === 'calling' ? 'secondary' : 'ghost'}
                      size="sm"
                      aria-pressed={figureMode === 'calling'}
                      onClick={() => setFigureMode('calling')}
                    >
                      Calling
                    </Button>
                  </div>
                )}
                {figuresLabel && (
                  <p className={figuresLabel === 'Improper' ? 'text-base text-muted-foreground' : 'text-base font-semibold'}>
                    {figuresLabel}
                  </p>
                )}
                <FiguresList items={figureMode === 'calling' ? (dance.calling_figures ?? []) : dance.figures} />
              </div>
              <div className="mt-10">
                <FieldList<DanceWithJoins> fields={danceWideFields} row={dance} className="space-y-4" />
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
