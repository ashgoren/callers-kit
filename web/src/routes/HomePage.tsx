import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import type { Dance } from '@/lib/powersync/schema'
import { useQuery } from '@powersync/react'

export function HomePage() {
  const { user, signOut } = useAuth()
  // Reactive: automatically re-runs and re-renders whenever the local
  // SQLite `dances` table changes — no manual refetching or polling.
  const { data: dances, isLoading } = useQuery<Dance>('SELECT id, title FROM dances')

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <p className="text-sm">
        Signed in as <span className="font-medium">{user?.email}</span>
      </p>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>

      <div className="w-full max-w-sm space-y-1">
        {isLoading ? (
          <p className="text-muted-foreground text-center text-sm">Loading…</p>
        ) : (
          <ul className="space-y-1">
            {dances.map((dance) => (
              <li key={dance.id} className="text-sm">
                {dance.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
