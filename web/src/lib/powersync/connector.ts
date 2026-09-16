import { supabase } from '@/lib/supabase'
import { UpdateType } from '@powersync/web'
import { JSON_COLUMNS } from './schema'
import type { CommonPowerSyncDatabase, PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/web'

// Postgres SQLSTATE classes 22 (data exception) and 23 (integrity
// constraint violation) - not-null, unique, check, foreign-key violations,
// malformed values, etc. - mean the *data* itself is invalid for this
// write. Retrying the exact same payload can never succeed for these, so
// without treating them as permanent failures, PowerSync retries the same
// doomed upload forever, blocking every later queued write behind it (a
// stale queued edit from before a field had validation is exactly how this
// arises in practice, not just a hypothetical). Anything outside these two
// classes (network errors, auth failures, rate limiting, server errors) is
// left to throw and retry normally, since those genuinely can succeed on a
// later attempt.
function isPermanentFailure(error: { code?: string }): boolean {
  return error.code?.startsWith('22') === true || error.code?.startsWith('23') === true
}

function decodeJsonColumns(table: string, opData: Record<string, unknown>): Record<string, unknown> {
  const jsonColumns = JSON_COLUMNS[table]
  if (!jsonColumns) return opData

  const decoded = { ...opData }
  for (const name of jsonColumns) {
    const value = decoded[name]
    // A PATCH carries only changed columns, so absent is normal.
    if (typeof value !== 'string') continue
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
      let opData: Record<string, unknown>
      try {
        opData = decodeJsonColumns(op.table, op.opData ?? {})
      } catch (error) {
        // A malformed column_state can never become valid JSON by
        // retrying - same permanent-failure reasoning as the 23505 case
        // below, just caught at the decode step instead of arriving as a
        // Postgres response. Skipping this one op (instead of letting the
        // throw escape uploadData(), which would stall the whole
        // transaction retrying forever) drains the queue; a later real
        // edit naturally overwrites whatever was corrupted.
        console.warn(`uploadData: skipping ${op.table} op with unparseable JSON column`, error)
        continue
      }

      // supabase-js does NOT throw on failure - it returns { data, error }.
      // Each branch below explicitly checks `error` and throws, so a failed
      // write actually surfaces to PowerSync (which then retries) instead of
      // silently completing successfully and losing the edit.
      switch (op.op) {
        case UpdateType.PUT: {
          const { error } = await supabase.from(op.table).upsert({ id: op.id, ...opData })
          if (error && !isPermanentFailure(error)) throw error
          if (error) console.warn(`uploadData: skipping permanently-failing PUT on ${op.table}`, error)
          break
        }
        case UpdateType.PATCH: {
          const { error } = await supabase.from(op.table).update(opData).eq('id', op.id)
          if (error && !isPermanentFailure(error)) throw error
          if (error) console.warn(`uploadData: skipping permanently-failing PATCH on ${op.table}`, error)
          break
        }
        case UpdateType.DELETE: {
          const { error } = await supabase.from(op.table).delete().eq('id', op.id)
          if (error && !isPermanentFailure(error)) throw error
          if (error) console.warn(`uploadData: skipping permanently-failing DELETE on ${op.table}`, error)
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