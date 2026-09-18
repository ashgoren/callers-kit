import { cn } from 'cn'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { EditableRichText } from '@/components/fields/EditableRichText'
import { EditableText } from '@/components/fields/EditableText'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { Switch } from '@/components/ui/switch'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { formatDate, sortAlphabetically } from '@/lib/format'
import { getDefaultSkeleton } from '@/lib/phraseSkeleton'
import { makeFiguresLabel } from './DancesPage.columns'
import { useDance } from './DanceDetailPage.data'
import { danceMetadataFields } from './DanceDetailPage.fields'
import { FigureToolbar } from './FigureToolbar'
import { FiguresList } from './FiguresList'
import type { Editor } from '@tiptap/react'
import type { DanceWithJoins } from './DancesPage.columns'

const titleSchema = z.string().min(1, 'Title is required')

export function DanceDetailPage() {
  const { id, versionId } = useParams()
  const navigate = useNavigate()
  const { dance, isLoading } = useDance(id ?? '')
  const [activeFigureEditor, setActiveFigureEditor] = useState<Editor | null>(null)

  if (isLoading) return <PageSpinner />

  const figuresLabel = dance ? makeFiguresLabel(dance) : ''
  const selectedVersion = dance?.versions.find((version) => version.id === versionId) ?? dance?.versions[0]
  const skeleton = getDefaultSkeleton(dance?.dance_type ?? null)

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
                  {/* min-h-7 matches the toolbar's height */}
                  <div className="flex min-h-7 items-center gap-4">
                    {figuresLabel && (
                      <p className={figuresLabel === 'Improper' ? 'text-base text-muted-foreground' : 'text-base font-semibold'}>
                        {figuresLabel}
                      </p>
                    )}
                    <div className="ml-auto flex items-center gap-4">
                      {activeFigureEditor && <FigureToolbar editor={activeFigureEditor} />}
                      {skeleton && selectedVersion && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          Manual phrasing
                          <Switch
                            checked={selectedVersion.manual_phrasing}
                            onCheckedChange={(checked) =>
                              void commitFieldEdit('dance_versions', selectedVersion.id, 'manual_phrasing', checked ? 1 : 0)
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <FiguresList
                    items={selectedVersion?.figures ?? []}
                    skeleton={skeleton}
                    manualPhrasing={selectedVersion?.manual_phrasing ?? true}
                    onChange={(newFigures) =>
                      selectedVersion && void commitFieldEdit('dance_versions', selectedVersion.id, 'figures', JSON.stringify(newFigures))
                    }
                    onActiveEditorChange={setActiveFigureEditor}
                  />
                </div>
                {selectedVersion && (
                  <div className="mt-8 flex flex-wrap gap-2 border-t pt-8">
                    <Link
                      to={
                        selectedVersion.id === dance.versions[0]?.id
                          ? `/dances/${dance.id}/walkthrough`
                          : `/dances/${dance.id}/versions/${selectedVersion.id}/walkthrough`
                      }
                      className={buttonVariants({ variant: 'outline' })}
                    >
                      Walkthrough
                    </Link>
                    <Link
                      to={
                        selectedVersion.id === dance.versions[0]?.id
                          ? `/dances/${dance.id}/cues`
                          : `/dances/${dance.id}/versions/${selectedVersion.id}/cues`
                      }
                      className={buttonVariants({ variant: 'outline' })}
                    >
                      Cues
                    </Link>
                  </div>
                )}
                {selectedVersion && (
                  <div className="mt-8 border-t pt-8">
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
