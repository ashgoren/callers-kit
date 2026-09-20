import { ArrowLeft } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { Slider } from '@/components/ui/slider'
import { buildChoreographyRows } from '@/lib/choreographyPhrases'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { makeFiguresLabel } from '@/routes/dances/DancesPage.columns'
import { useProgramChoreographyDances } from './ProgramChoreographyPage.data'
import { useProgram } from './ProgramDetailPage.data'

const MIN_COLUMN_MIN_WIDTH = 100
const MAX_COLUMN_MIN_WIDTH = 300
const DEFAULT_COLUMN_MIN_WIDTH = (MIN_COLUMN_MIN_WIDTH + MAX_COLUMN_MIN_WIDTH) / 2

export function ProgramChoreographyPage() {
  const { id } = useParams()
  const { program, isLoading: isProgramLoading } = useProgram(id ?? '')
  const { dances, isLoading: isDancesLoading } = useProgramChoreographyDances(id ?? '')
  const [columnMinWidth, setColumnMinWidth] = useState(DEFAULT_COLUMN_MIN_WIDTH)

  if (isProgramLoading || isDancesLoading) return <PageSpinner />
  if (!program) return <p className="p-4 text-sm text-muted-foreground">Program not found.</p>

  const rows = buildChoreographyRows(dances)

  return (
    <div className="p-4">
      <Link
        to={`/programs/${program.id}`}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to program
      </Link>
      <h1 className="mt-2 mb-6 font-semibold text-2xl">
        {formatDate(program.date)}
        {program.location && <span className="ml-2 text-base font-normal text-muted-foreground">{program.location}</span>}
      </h1>

      {dances.length === 0 ? (
        <p className="text-sm text-muted-foreground">This program has no dances yet.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None of these dances have any figures yet.</p>
      ) : (
        <>
          <div className="mb-4 flex max-w-xs items-center gap-3 text-xs text-muted-foreground">
            <span>Compact</span>
            <Slider
              aria-label="Column density"
              min={MIN_COLUMN_MIN_WIDTH}
              max={MAX_COLUMN_MIN_WIDTH}
              step={10}
              value={columnMinWidth}
              onValueChange={(value) => setColumnMinWidth(value)}
            />
            <span>Spacious</span>
          </div>

          <div className="overflow-x-auto">
            <div
              className="grid gap-x-3"
              style={{ gridTemplateColumns: `auto repeat(${dances.length}, minmax(${columnMinWidth}px, 1fr))` }}
            >
              <div />
              {/* Lineup position - same muted/tabular-nums treatment
                  ProgramDanceLineup itself uses for this same number, in its
                  own row above the title rather than crowded in beside it. */}
              {dances.map((dance) => (
                <div key={dance.danceId} className="text-xs tabular-nums text-muted-foreground">
                  {dance.order}
                </div>
              ))}
              <div />
              {dances.map((dance) => {
                const figuresLabel = makeFiguresLabel({ dance_type: dance.danceType, formation: dance.formation, progression: dance.progression })
                const keyMoves = sortAlphabetically(dance.keyMoves.map((keyMove) => keyMove.name ?? ''))
                return (
                  <div key={dance.danceId} className="pb-2">
                    <Link to={`/dances/${dance.danceId}`} className="text-sm font-semibold hover:underline">
                      {dance.title}
                    </Link>
                    {figuresLabel && <div className="text-sm tracking-wide text-muted-foreground uppercase">{figuresLabel}</div>}
                    {keyMoves.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {keyMoves.map((name) => (
                          <span key={name} className="rounded-full border bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {rows.map((row) => (
                <Fragment key={row.phrase}>
                  <div className="border-t py-3 pr-2 font-semibold text-muted-foreground">{row.phrase}</div>
                  {row.figuresByDance.map((figures, index) => (
                    <div key={dances[index].danceId} className="space-y-1 border-t py-3 text-sm">
                      {figures.length === 0
                        ? mutedPlaceholder
                        : figures.map((figure) => (
                            <div key={figure.id} className="flex gap-1.5">
                              {figure.beats !== null && <span className="shrink-0 text-muted-foreground">{figure.beats}</span>}
                              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(figure.description) }} />
                            </div>
                          ))}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
