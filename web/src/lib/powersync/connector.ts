import { supabase } from '@/lib/supabase'
import { UpdateType } from '@powersync/web'
import type { CommonPowerSyncDatabase, PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/web'

export class SupabaseConnector implements PowerSyncBackendConnector {
  // PowerSync calls this automatically whenever it needs to (re)authenticate
  // the sync connection — including periodically while already connected,
  // since Supabase access tokens expire hourly. Must always return whatever
  // session is CURRENTLY valid, never a cached/stale one.
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      // db.connect() should only ever be called once signed in, so this
      // means something upstream broke that invariant.
      throw new Error('fetchCredentials() called with no active Supabase session')
    }

    return {
      endpoint: import.meta.env.VITE_POWERSYNC_URL,
      token: session.access_token,
    }
  }

  // PowerSync calls this automatically whenever local writes are pending.
  // Pulls one transaction's worth of queued changes and replays each as a
  // normal Supabase call — the same RLS-protected write path any other
  // Supabase client call goes through. No writes exist yet at this step
  // (nothing in the UI calls db.execute()), so this won't run in practice
  // until step 1.5, but it's implemented for real now rather than stubbed.
  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    for (const op of transaction.crud) {
      // supabase-js does NOT throw on failure — it returns { data, error }.
      // Each branch below explicitly checks `error` and throws, so a failed
      // write actually surfaces to PowerSync (which then retries) instead of
      // silently completing successfully and losing the edit.
      switch (op.op) {
        case UpdateType.PUT: {
          const { error } = await supabase.from(op.table).upsert({ id: op.id, ...op.opData })
          if (error) throw error
          break
        }
        case UpdateType.PATCH: {
          // opData is only undefined for DELETE ops (per CrudEntry), never PATCH
          const { error } = await supabase
            .from(op.table)
            .update(op.opData ?? {})
            .eq('id', op.id)
          if (error) throw error
          break
        }
        case UpdateType.DELETE: {
          const { error } = await supabase.from(op.table).delete().eq('id', op.id)
          if (error) throw error
          break
        }
      }
    }

    // Tells PowerSync this batch succeeded and it's safe to advance the
    // queue. If this is never called, the same transaction is returned by
    // getNextCrudTransaction() forever and uploads stall permanently.
    await transaction.complete()
  }
}
