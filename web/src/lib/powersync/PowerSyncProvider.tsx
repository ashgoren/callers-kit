import { useAuth } from '@/contexts/AuthContext'
import { PowerSyncContext } from '@powersync/react'
import { useEffect } from 'react'
import { SupabaseConnector } from './connector'
import { db } from './database'

// connect() must run exactly once for the lifetime of the page, no matter
// how many times this component mounts. React Strict Mode (dev only) fully
// unmounts and remounts every component once, so a useRef guard inside the
// component wouldn't help — a fresh ref gets created on the second mount too.
// This flag lives at module scope instead, alongside the `db` singleton it's
// guarding, so it survives across every mount/unmount Strict Mode causes.
let hasConnected = false

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  useEffect(() => {
    // fetchCredentials() (in the connector) needs an active Supabase
    // session, so only connect once someone is actually signed in — never
    // on load for a signed-out visitor. In practice this component is only
    // ever mounted inside ProtectedRoute, so `user` is already guaranteed
    // here — the check is just defensive, in case that ever changes.
    if (user && !hasConnected) {
      hasConnected = true
      // Deliberately not awaited — connect() is fire-and-forget, sync runs
      // in the background.
      void db.connect(new SupabaseConnector())
    }
  }, [user])

  // `db` always exists (it's a module singleton, independent of auth state),
  // so the context can be provided unconditionally — components using
  // useQuery() before connect() has run just see their normal loading state
  // until the first sync completes.
  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  )
}
