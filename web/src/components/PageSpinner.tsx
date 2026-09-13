import { Spinner } from '@/components/ui/spinner'

// A page's own centered loading placeholder, shown while its data (and/or,
// for an entity table page, its synced column preferences) is still loading.
export function PageSpinner() {
  return (
    <div className="p-4 text-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}
