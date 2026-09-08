import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { PowerSyncContext } from '@powersync/react'
import { useEffect, useState } from 'react'
import { SupabaseConnector } from './connector'
import { db } from './database'

// connect() must run exactly once for the lifetime of the page, no matter
// how many times this component mounts. React Strict Mode (dev only) fully
// unmounts and remounts every component once, so a useRef guard inside the
// component wouldn't help - a fresh ref gets created on the second mount too.
// This flag lives at module scope instead, alongside the `db` singleton it's
// guarding, so it survives across every mount/unmount Strict Mode causes.
let hasConnected = false

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [connectionError, setConnectionError] = useState<Error | null>(null)
  // Bumped by the Retry button to re-run the effect below without a full
  // page reload - the only other way to get a fresh connect() attempt,
  // since `hasConnected` normally blocks every attempt after the first.
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    // fetchCredentials() (in the connector) needs an active Supabase
    // session, so only connect once someone is actually signed in - never
    // on load for a signed-out visitor. In practice this component is only
    // ever mounted inside ProtectedRoute, so `user` is already guaranteed
    // here - the check is just defensive, in case that ever changes.
    if (user && !hasConnected) {
      hasConnected = true
      // connect() itself resolves quickly (sync continues in the
      // background) but can still reject outright - e.g. a browser that
      // can't open the local SQLite storage at all (known case: Safari
      // Private Browsing has no OPFS support).
      db.connect(new SupabaseConnector()).catch((error: unknown) => {
        hasConnected = false
        console.error('PowerSync connect() failed:', error)
        setConnectionError(error instanceof Error ? error : new Error(String(error)))
      })
    }
  }, [user, retryToken])

  if (connectionError) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center text-sm">
        <p role="alert" className="text-destructive">
          Couldn't connect to sync: {connectionError.message}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setConnectionError(null)
            setRetryToken((token) => token + 1)
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  // `db` always exists (it's a module singleton, independent of auth state),
  // so the context can be provided unconditionally - components using
  // useQuery() before connect() has run just see their normal loading state
  // until the first sync completes.
  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  )
}
