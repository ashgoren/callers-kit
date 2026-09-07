import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import type { Dance } from '@/lib/powersync/schema'
import { useQuery } from '@powersync/react'

export function DancesPage() {
  // Reactive: automatically re-runs and re-renders whenever the local
  // SQLite `dances` table changes — no manual refetching or polling.
  const { data: dances, isLoading } = useQuery<Dance>('SELECT id, title FROM dances')

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <div className="w-full max-w-sm space-y-1">
        {isLoading ? (
          <p className="text-muted-foreground text-center text-sm">Loading…</p>
        ) : (
          <ul className="space-y-1">
            {dances.map((dance) => (
              <li key={dance.id}>
                <EditableDanceTitle dance={dance} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Minimal first cut of blur-save field editing — no validation, no undo yet
// (all land in later phases). Click-to-edit: the read-only view always
// renders the live `dance.title` prop directly (no local state, so it can
// never go stale when a remote change arrives). The input only exists while
// actively editing — mounted fresh each time, so its local draft always
// starts from the current value rather than a value captured once and never
// refreshed.
function EditableDanceTitle({ dance }: { dance: Dance }) {
  const [isEditing, setIsEditing] = useState(false)

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="w-full rounded-md px-3 py-1 text-left text-sm hover:bg-muted"
      >
        {dance.title || <span className="text-muted-foreground">Untitled</span>}
      </button>
    )
  }

  return <EditableDanceTitleInput dance={dance} onDone={() => setIsEditing(false)} />
}

function EditableDanceTitleInput({ dance, onDone }: { dance: Dance; onDone: () => void }) {
  // dance.title is string | null — every PowerSync column is nullable at
  // the type level, since SQLite itself doesn't enforce NOT NULL here.
  const [draft, setDraft] = useState(dance.title ?? '')

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== (dance.title ?? '')) {
          void commitFieldEdit('dances', dance.id, 'title', draft)
        }
        onDone()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
