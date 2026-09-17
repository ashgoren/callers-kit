import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { EditableRichText } from '@/components/fields/EditableRichText'
import { PageSpinner } from '@/components/PageSpinner'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { sortAlphabetically } from '@/lib/format'
import { makeFiguresLabel, makeMobileEditTitle } from './DancesPage.columns'
import { useDanceVersionWalkthrough } from './DanceWalkthroughPage.data'

export function DanceWalkthroughPage() {
  const { id, versionId } = useParams()
  const { version, isLoading } = useDanceVersionWalkthrough({ danceId: id ?? '', versionId })

  if (isLoading) return <PageSpinner />

  const figuresLabel = version ? makeFiguresLabel(version) : ''
  const mobileTitle = version
    ? makeMobileEditTitle({
        action: 'Walkthrough',
        title: version.dance_title,
        choreographers: version.choreographers,
        figuresLabel,
        versionLabel: version.version_count > 1 ? version.label : null,
      })
    : ''
  const backToDance = version
    ? version.order === 0
      ? `/dances/${version.dance_id}`
      : `/dances/${version.dance_id}/versions/${version.id}`
    : ''

  return (
    // flex h-full gives the walkthrough editor room to grow up to whatever's left of the viewport
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      {!version ? (
        <p className="text-sm text-muted-foreground">Dance version not found.</p>
      ) : (
        <>
          <Link
            to={backToDance}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to dance
          </Link>
          <div className="mt-2 border-b pb-4">
            <Link to={backToDance} className="hover:underline">
              <h1 className="font-semibold text-2xl">
                {version.dance_title}
                {(version.choreographers.length > 0 || figuresLabel) && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    {version.choreographers.length > 0 && `by ${sortAlphabetically(version.choreographers).join(', ')} `}
                    {figuresLabel && (
                      <>
                        (<span className={figuresLabel === 'Improper' ? undefined : 'font-semibold'}>{figuresLabel}</span>)
                      </>
                    )}
                  </span>
                )}
              </h1>
            </Link>
            {version.version_count > 1 && (
              <p className="mt-1 text-base text-muted-foreground">Version: {version.label}</p>
            )}
          </div>
          <div className="mt-6 min-h-0 flex-1">
            <EditableRichText
              value={version.walkthrough}
              onCommit={(value) => void commitFieldEdit('dance_versions', version.id, 'walkthrough', value)}
              size="base"
              fillHeight
              mobileTitle={mobileTitle}
            />
          </div>
        </>
      )}
    </div>
  )
}
