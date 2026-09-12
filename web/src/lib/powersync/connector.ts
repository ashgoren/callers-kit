import { supabase } from '@/lib/supabase'
import { UpdateType } from '@powersync/web'
import type { CommonPowerSyncDatabase, PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/web'

// A legitimate column_state (visibility flags, one sort key, a
// pinning/order array, per-column widths) is a few hundred bytes at most,
// so this is a generous ceiling meant only to catch corruption, not to
// constrain real usage.
const MAX_JSON_COLUMN_LENGTH = 10_000

// Postgres jsonb has no SQLite equivalent, so schema.ts mirrors every
// jsonb column as text and op.opData carries it as a JSON string. Sent
// as-is, Postgres would store a string scalar wrapping the real JSON,
// and every round trip would add another layer of encoding.
//
// Every jsonb column in schema.ts belongs in this map.
const JSON_COLUMNS: Record<string, readonly string[]> = {
  user_table_preferences: ['column_state'],
}

function decodeJsonColumns(table: string, opData: Record<string, unknown>): Record<string, unknown> {
  const jsonColumns = JSON_COLUMNS[table]
  if (!jsonColumns) return opData

  const decoded = { ...opData }
  for (const name of jsonColumns) {
    const value = decoded[name]
    // A PATCH carries only changed columns, so absent is normal.
    if (typeof value !== 'string') continue
    if (value.length > MAX_JSON_COLUMN_LENGTH) {
      console.warn(`uploadData: discarding oversized ${table}.${name} (${value.length} chars)`)
      decoded[name] = {}
      continue
    }
    decoded[name] = JSON.parse(value)
  }
  return decoded
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  // PowerSync calls this automatically whenever it needs to (re)authenticate
  // the sync connection - including periodically while already connected,
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
  // normal Supabase call - the same RLS-protected write path any other
  // Supabase client call goes through. No writes exist yet at this step
  // (nothing in the UI calls db.execute()), so this won't run in practice
  // until step 1.5, but it's implemented for real now rather than stubbed.
  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    for (const op of transaction.crud) {
      // opData is only undefined for DELETE ops (per CrudEntry), never PUT/PATCH.
      const opData = decodeJsonColumns(op.table, op.opData ?? {})

      // supabase-js does NOT throw on failure - it returns { data, error }.
      // Each branch below explicitly checks `error` and throws, so a failed
      // write actually surfaces to PowerSync (which then retries) instead of
      // silently completing successfully and losing the edit.
      switch (op.op) {
        case UpdateType.PUT: {
          const { error } = await supabase.from(op.table).upsert({ id: op.id, ...opData })
          // 23505 = Postgres unique_violation: a row with this natural key
          // already exists. Nothing in this app's current write paths
          // creates rows client-side without knowing whether one already
          // exists, but a stale queued PUT from an earlier version of the
          // client (or a genuine same-moment race between two devices) can
          // still be sitting in a device's local upload queue. PowerSync
          // retries a failed upload indefinitely, so throwing here would
          // leave that device stuck retrying a write that can never
          // succeed - hammering the same conflict forever - instead of
          // recognizing the row it wanted to create already exists and
          // moving on.
          if (error && error.code !== '23505') throw error
          if (error) console.warn(`uploadData: ignoring unique-violation PUT on ${op.table} (row already exists)`, error)
          break
        }
        case UpdateType.PATCH: {
          const { error } = await supabase.from(op.table).update(opData).eq('id', op.id)
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