import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSaveCancelFieldEdit } from '@/hooks/useSaveCancelFieldEdit'
import { mutedPlaceholder } from '@/lib/format'
import { videoUrlSchema } from '@/lib/videos'
import { VideosList } from './VideosList'
import type { Video } from '@/lib/videos'

function VideosReadOnlyList({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return mutedPlaceholder
  return (
    <ul className="space-y-0.5">
      {videos.map((video) => (
        <li key={video.id}>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block max-w-full truncate align-bottom hover:underline"
          >
            {video.description || 'Video'}
          </a>
        </li>
      ))}
    </ul>
  )
}

// The dance-detail "Videos" field: a read-only list of links, with a pencil
// beside its own label that opens a modal editor. Renders its own label + pencil
// row rather than going through FieldList's generic dt/dd.
//
// The dialog holds its own local draft (`draftItems`), seeded from
// fieldEdit.draft when it opens - like EditableRichText's Tiptap instance,
// VideosList's own reordering/add/remove/edit happen entirely against that
// local state, and only reach fieldEdit (and from there, PowerSync) via the
// explicit Save button. Cancel, Escape, and clicking outside the dialog all
// route through fieldEdit.attemptCancel, which warns before discarding if
// anything actually changed.
export function VideosField({ value, onCommit }: { value: Video[]; onCommit: (value: Video[]) => void }) {
  const fieldEdit = useSaveCancelFieldEdit<Video[]>({ value, onCommit })
  const [draftItems, setDraftItems] = useState<Video[]>(value)

  function handleOpen() {
    setDraftItems(fieldEdit.draft)
    fieldEdit.onFocus()
  }

  function handleCancel() {
    fieldEdit.attemptCancel(draftItems)
  }

  const hasIncompleteVideo = draftItems.some((video) => !videoUrlSchema.safeParse(video.url).success)

  return (
    <div>
      <div className="flex items-center gap-1">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Videos</p>
        <Tooltip>
          <TooltipTrigger
            render={<Button type="button" variant="ghost" size="icon-xs" aria-label="Edit videos" onClick={handleOpen} />}
          >
            <Pencil className="text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>Edit videos</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-1 text-sm">
        <VideosReadOnlyList videos={value} />
      </div>
      <Dialog open={fieldEdit.isFocused} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Videos</DialogTitle>
          </DialogHeader>
          <VideosList items={draftItems} onChange={setDraftItems} />
          {fieldEdit.error !== null && <p className="text-xs text-destructive">{fieldEdit.error}</p>}
          <DialogFooter>
            <Button type="button" variant={fieldEdit.error ? 'destructive' : 'ghost'} size="sm" onClick={handleCancel}>
              {fieldEdit.error ? 'Discard' : 'Cancel'}
            </Button>
            <Button type="button" size="sm" disabled={hasIncompleteVideo} onClick={() => fieldEdit.onChange(draftItems)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
