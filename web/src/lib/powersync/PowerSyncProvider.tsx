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

  useEffect(() => {
    // fetchCredentials() (in the connector) needs an active Supabase
    // session, so only connect once someone is actually signed in - never
    // on load for a signed-out visitor. In practice this component is only
    // ever mounted inside ProtectedRoute, so `user` is already guaranteed
    // here - the check is just defensive, in case that ever changes.
    if (user && !hasConnected) {
      hasConnected = true
      // db.connect()'s own promise can't be used to detect this: internally,
      // ConnectionManager.connect() (@powersync/shared-internals) wraps the
      // whole attempt in .catch(() => {}), by design, so it can keep
      // silently retrying a transient network/sync issue instead of
      // surfacing every one as a hard error - meaning connect() effectively
      // never rejects. waitForReady() is the one that actually rejects, and
      // only for a genuinely broken local database: it resolves once
      // PowerSync finishes opening + initializing the local SQLite database,
      // before any network sync is involved at all - e.g. a browser that
      // can't provide the configured storage (known case: private/incognito
      // browsing has no OPFS support in most non-Chromium browsers -
      // confirmed in both Safari and Firefox). Both are awaited together
      // since either failing means there's nothing usable to show.
      //
      // Every step inside that local-database init is local-only (opening
      // storage, loading the schema, running a PRAGMA) - none of it touches
      // the network - so a rejection here is never a transient blip the way
      // a network hiccup would be. It's also not something a plain retry on
      // this same page could fix even if it were transient: `db` is a
      // module-level singleton, so its cached, already-rejected internal
      // ready-promise is exactly what waitForReady() would keep returning on
      // a second call. Only a real reload - a fresh module graph, a fresh
      // `db` - can possibly produce a different outcome, which is why the
      // error UI below reloads the page rather than re-running this effect.
      Promise.all([db.waitForReady(), db.connect(new SupabaseConnector())]).catch((error: unknown) => {
        console.error('PowerSync failed to start:', error)
        setConnectionError(error instanceof Error ? error : new Error(String(error)))
      })
    }
  }, [user])

  if (connectionError) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center text-sm">
        <p role="alert" className="text-destructive">
          Couldn't start sync: {connectionError.message}
        </p>
        <p className="text-muted-foreground mb-2">
          This usually means the browser does not support local storage - e.g. private/incognito browsing mode.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
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
