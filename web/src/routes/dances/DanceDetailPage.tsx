import { cn } from 'cn'
import { Eye, Footprints, Grid3x3, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EditableNumber } from '@/components/fields/EditableNumber'
import { EditableRichText } from '@/components/fields/EditableRichText'
import { EditableSelect } from '@/components/fields/EditableSelect'
import { EditableTagCombobox } from '@/components/fields/EditableTagCombobox'
import { EditableText } from '@/components/fields/EditableText'
import { PageSpinner } from '@/components/PageSpinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEscapeWhenUnfocused } from '@/hooks/useEscapeWhenUnfocused'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { getDefaultSkeleton } from '@/lib/phraseSkeleton'
import { formatProgramLabel } from '@/routes/programs/ProgramsPage.columns'
import { formatFormation, makeFiguresLabel } from './dance'
import { DANCE_TYPES, difficultySchema, formatUrl, FORMATIONS, PROGRESSIONS, urlSchema } from './DanceDetailPage.constants'
import { useDance } from './DanceDetailPage.data'
import { FigureToolbar } from './FigureToolbar'
import { FiguresList } from './FiguresList'
import { VideosField } from './VideosField'
import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import type { DanceWithJoins } from './dance'

const titleSchema = z.string().min(1, 'Title is required')

function FieldLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function renderProgramHistory(value: DanceWithJoins['programs']): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return (
    <ul className="space-y-0.5">
      {value.map((program) => (
        <li key={program.id}>
          <Link to={`/programs/${program.id}`} className="hover:underline">
            {formatProgramLabel(program)}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function DanceDetailPage() {
  const { id, versionId } = useParams()
  const navigate = useNavigate()
  const { dance, isLoading } = useDance(id ?? '')
  const [activeFigureEditor, setActiveFigureEditor] = useState<Editor | null>(null)
  const [isEditingFigures, setIsEditingFigures] = useState(false)

  // Escape while nothing on the page has focus leaves figures edit mode.
  // While a figure's own sub-field is focused, Escape reaches that field's
  // own handling instead.
  useEscapeWhenUnfocused(() => setIsEditingFigures(false), isEditingFigures)
  useDocumentTitle(dance ? dance.title || 'Untitled' : null)

  if (isLoading) return <PageSpinner />

  const figuresLabel = dance ? makeFiguresLabel(dance) : ''
  const selectedVersion = dance?.versions.find((version) => version.id === versionId) ?? dance?.versions[0]
  const skeleton = getDefaultSkeleton(dance?.dance_type ?? null)
  // The primary version's walkthrough/cues live at the plain /dances/:id/... routes;
  // every other version needs its own id in the path to disambiguate.
  const isPrimaryVersion = selectedVersion?.id === dance?.versions[0]?.id
  const versionPathSegment = selectedVersion && dance ? (isPrimaryVersion ? '' : `/versions/${selectedVersion.id}`) : ''
  const walkthroughHref = dance ? `/dances/${dance.id}${versionPathSegment}/walkthrough` : ''
  const cuesHref = dance ? `/dances/${dance.id}${versionPathSegment}/cues` : ''

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
              fullWidth={false}
              className="font-semibold text-4xl md:text-4xl"
              // Extra md:text-4xl needed for edit mode since Input has default text-sm className.
            />
            <EditableTagCombobox
              danceId={dance.id}
              junctionTable="dances_choreographers"
              refIdColumn="choreographer_id"
              ownerTable="choreographers"
              value={dance.choreographers}
              placeholder="Add a choreographer..."
              as="p"
              // pl-3.25: lines up with the title + its padding + its invisible border.
              className="mt-1 pl-3.25 text-base text-muted-foreground"
              renderDisplay={(attached) =>
                attached.length === 0
                  ? mutedPlaceholder
                  : `by ${sortAlphabetically(attached.map((choreographer) => choreographer.name ?? '')).join(', ')}`
              }
            />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-[3fr_1fr]">
            <div>
              {dance.versions.length > 1 && (
                <Tabs
                  value={selectedVersion?.id}
                  onValueChange={(value: string) => void navigate(`/dances/${dance.id}/versions/${value}`)}
                >
                  <TabsList>
                    {dance.versions.map((version) => (
                      <TabsTab key={version.id} value={version.id}>
                        {version.label}
                      </TabsTab>
                    ))}
                  </TabsList>
                </Tabs>
              )}
              <div
                className={cn(
                  'rounded-lg border p-4',
                  dance.versions.length > 1 && 'rounded-t-none border-t-0',
                )}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {figuresLabel && (
                      <p className={figuresLabel === 'Improper' ? 'text-base text-muted-foreground' : 'text-base font-semibold'}>
                        {figuresLabel}
                      </p>
                    )}
                    {isEditingFigures && (
                      // order-3 + w-full: wraps to its own full-width line below the label/edit-toggle line on mobile,
                      // where the toolbar's touch-sized buttons don't fit alongside them.
                      <div className="order-3 min-h-7 w-full pointer-coarse:min-h-12 sm:order-2 sm:ml-auto sm:w-auto">
                        {activeFigureEditor && <FigureToolbar editor={activeFigureEditor} />}
                      </div>
                    )}
                    <div className="order-2 ml-auto flex items-center gap-1 sm:order-3">
                      {selectedVersion && !isEditingFigures && (
                        <>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Link
                                  to={walkthroughHref}
                                  aria-label="Walkthrough"
                                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                                />
                              }
                            >
                              <Footprints className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>Walkthrough</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Link
                                  to={cuesHref}
                                  aria-label="Cues"
                                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                                />
                              }
                            >
                              <Grid3x3 className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>Cues</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={isEditingFigures ? 'Done editing figures' : 'Edit figures'}
                              onClick={() => setIsEditingFigures((current) => !current)}
                            />
                          }
                        >
                          {isEditingFigures ? <Eye className="size-4" /> : <Pencil className="size-4" />}
                        </TooltipTrigger>
                        <TooltipContent>{isEditingFigures ? 'Done editing' : 'Edit figures'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <FiguresList
                    items={selectedVersion?.figures ?? []}
                    skeleton={skeleton}
                    manualPhrasing={selectedVersion?.manual_phrasing ?? true}
                    isEditing={isEditingFigures}
                    onChange={(newFigures) =>
                      selectedVersion && void commitFieldEdit('dance_versions', selectedVersion.id, 'figures', JSON.stringify(newFigures))
                    }
                    onToggleManualPhrasing={(checked) =>
                      selectedVersion && void commitFieldEdit('dance_versions', selectedVersion.id, 'manual_phrasing', checked ? 1 : 0)
                    }
                    onActiveEditorChange={setActiveFigureEditor}
                  />
                </div>
                {selectedVersion && (
                  <div className="mt-8 border-t pt-8">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
                    <div className="mt-1">
                      <EditableRichText
                        // Keyed by version id so switching versions fully remounts this field.
                        key={selectedVersion.id}
                        value={selectedVersion.notes}
                        onCommit={(value) => void commitFieldEdit('dance_versions', selectedVersion.id, 'notes', value)}
                        fieldName="notes"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-1">
                <FieldLine label="Key Moves">
                  <EditableTagCombobox
                    danceId={dance.id}
                    junctionTable="dances_key_moves"
                    refIdColumn="key_move_id"
                    ownerTable="key_moves"
                    value={dance.key_moves}
                    placeholder="Add a key move..."
                    renderDisplay={(attached) =>
                      attached.length === 0
                        ? mutedPlaceholder
                        : sortAlphabetically(attached.map((tag) => tag.name ?? '')).join(', ')
                    }
                  />
                </FieldLine>
                <FieldLine label="Vibes">
                  <EditableTagCombobox
                    danceId={dance.id}
                    junctionTable="dances_vibes"
                    refIdColumn="vibe_id"
                    ownerTable="vibes"
                    value={dance.vibes}
                    placeholder="Add a vibe..."
                    renderDisplay={(attached) =>
                      attached.length === 0
                        ? mutedPlaceholder
                        : sortAlphabetically(attached.map((tag) => tag.name ?? '')).join(', ')
                    }
                  />
                </FieldLine>
                <FieldLine label="Difficulty">
                  <EditableNumber
                    value={dance.difficulty}
                    onCommit={(v) => void commitFieldEdit('dances', dance.id, 'difficulty', v)}
                    schema={difficultySchema}
                    min={0}
                  />
                </FieldLine>
                <FieldLine label="Dance Type">
                  <EditableSelect
                    value={dance.dance_type}
                    onCommit={(v) => void commitFieldEdit('dances', dance.id, 'dance_type', v)}
                    options={DANCE_TYPES}
                  />
                </FieldLine>
                <FieldLine label="Formation">
                  <EditableSelect
                    value={dance.formation}
                    onCommit={(v) => void commitFieldEdit('dances', dance.id, 'formation', v)}
                    options={FORMATIONS}
                    formatLabel={formatFormation}
                  />
                </FieldLine>
                <FieldLine label="Progression">
                  <EditableSelect
                    value={dance.progression}
                    onCommit={(v) => void commitFieldEdit('dances', dance.id, 'progression', v)}
                    options={PROGRESSIONS}
                  />
                </FieldLine>
              </div>
              <VideosField value={dance.videos} onCommit={(v) => void commitFieldEdit('dances', dance.id, 'videos', JSON.stringify(v))} />
              <div>
                <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Programs</p>
                <div className="mt-1 text-sm">{renderProgramHistory(dance.programs)}</div>
              </div>
              <div className="space-y-1 border-t pt-4 text-sm text-muted-foreground">
                <p>
                  URL{' '}
                  <EditableText
                    value={dance.url ?? ''}
                    onCommit={(value) => void commitFieldEdit('dances', dance.id, 'url', value || null)}
                    schema={urlSchema}
                    placeholder="Add a URL..."
                    renderDisplay={formatUrl}
                    fullWidth={false}
                  />
                </p>
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
