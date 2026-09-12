import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CrudTransaction, UpdateType } from '@powersync/web'
import type { CommonPowerSyncDatabase, CrudEntry } from '@powersync/web'
import { SupabaseConnector } from './connector'

// supabase.from(table) returns a chainable query builder - .upsert() and
// .eq() (after .update()/.delete()) are the only calls our connector code
// actually makes, so that's all that's faked here.
//
// vi.hoisted() is required here (unlike commitFieldEdit.test.ts's simpler
// mock): vi.mock()'s factory is hoisted above regular `const` declarations,
// so without this, the factory below would reference fromMock before it's
// initialized. vi.hoisted() hoists this block too, so the mocks exist by
// the time vi.mock()'s factory runs.
const { fromMock, upsertMock, updateMock, deleteMock, eqMock, getSessionMock } = vi.hoisted(() => {
  const eqMock = vi.fn(() => ({ error: null as { message: string; code?: string } | null }))
  const upsertMock = vi.fn(() => ({ error: null as { message: string; code?: string } | null }))
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const deleteMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({
    upsert: upsertMock,
    update: updateMock,
    delete: deleteMock,
  }))
  // Real getSession() resolves { data: { session } }, session null when
  // signed out - matched here so fetchCredentials() can be tested against
  // both shapes without touching the real Supabase client.
  const getSessionMock = vi.fn(() =>
    Promise.resolve({ data: { session: null as { access_token: string } | null } }),
  )
  return { fromMock, upsertMock, updateMock, deleteMock, eqMock, getSessionMock }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock, auth: { getSession: getSessionMock } },
}))

// CrudEntry is an interface with a couple of comparison/serialization
// methods (toJSON, equals, toComparisonArray) that uploadData() never calls
// - it only reads .op/.table/.id/.opData. Faked minimally here and cast past
// the unused methods, rather than implementing behavior nothing exercises.
function makeCrudEntry(entry: Pick<CrudEntry, 'op' | 'table' | 'id' | 'opData'>): CrudEntry {
  return { clientId: 1, ...entry } as CrudEntry
}

function makeDatabase(transaction: CrudTransaction | null): CommonPowerSyncDatabase {
  return {
    getNextCrudTransaction: vi.fn(() => Promise.resolve(transaction)),
  } as unknown as CommonPowerSyncDatabase
}

describe('SupabaseConnector.uploadData', () => {
  let connector: SupabaseConnector

  beforeEach(() => {
    connector = new SupabaseConnector()
    fromMock.mockClear()
    upsertMock.mockClear().mockResolvedValue({ error: null })
    updateMock.mockClear()
    deleteMock.mockClear()
    eqMock.mockClear().mockResolvedValue({ error: null })
  })

  it('does nothing when there is no pending transaction', async () => {
    await connector.uploadData(makeDatabase(null))

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('upserts on PUT and completes the transaction', async () => {
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PUT,
          table: 'dances',
          id: '1',
          opData: { title: 'New Dance' },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(fromMock).toHaveBeenCalledWith('dances')
    expect(upsertMock).toHaveBeenCalledWith({ id: '1', title: 'New Dance' })
    expect(complete).toHaveBeenCalled()
  })

  it('treats a unique-violation (23505) on PUT as already applied, not a failure', async () => {
    // Guards against a permanently-stuck retry loop: PowerSync retries a
    // failed upload forever, so a PUT that can never succeed (the row
    // already exists) must complete the transaction rather than throw.
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PUT,
          table: 'user_table_preferences',
          id: '1',
          opData: { table_name: 'dances', column_state: '{}' },
        }),
      ],
      complete,
    )
    upsertMock.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    await connector.uploadData(makeDatabase(transaction))

    expect(complete).toHaveBeenCalled()
  })

  it('still throws on a PUT error that is not a unique violation', async () => {
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [makeCrudEntry({ op: UpdateType.PUT, table: 'dances', id: '1', opData: { title: 'X' } })],
      complete,
    )
    upsertMock.mockResolvedValueOnce({ error: { code: '23503', message: 'foreign key violation' } })

    await expect(connector.uploadData(makeDatabase(transaction))).rejects.toEqual({
      code: '23503',
      message: 'foreign key violation',
    })
    expect(complete).not.toHaveBeenCalled()
  })

  it('discards an oversized column_state on PUT instead of uploading it', async () => {
    // Guards against a permanently-stuck retry loop: a device whose local
    // queue holds a corrupted, huge column_state (from before
    // parseColumnState narrowed to known fields) would otherwise retry the
    // same doomed multi-MB upload forever, blocking every other queued
    // write behind it.
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PUT,
          table: 'user_table_preferences',
          id: '1',
          opData: { table_name: 'dances', column_state: 'x'.repeat(10_001) },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(upsertMock).toHaveBeenCalledWith({ id: '1', table_name: 'dances', column_state: {} })
    expect(complete).toHaveBeenCalled()
  })

  it('parses a normal-sized column_state into an object before sending on PUT', async () => {
    // column_state is jsonb in Postgres but text locally, so it always
    // arrives here as a JSON-encoded string - sending it unparsed would
    // store a jsonb string scalar instead of the object it represents (see
    // decodeJsonColumns's own comment for the round-trip bug this caused).
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PUT,
          table: 'user_table_preferences',
          id: '1',
          opData: { table_name: 'dances', column_state: '{"sorting":[]}' },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(upsertMock).toHaveBeenCalledWith({ id: '1', table_name: 'dances', column_state: { sorting: [] } })
  })

  it('leaves a json-shaped column alone on a table with no json columns', async () => {
    // Decoding is driven by JSON_COLUMNS, so a column that merely shares a
    // name with a json column on another table must pass through as the
    // plain text it is.
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PUT,
          table: 'dances',
          id: '1',
          opData: { column_state: 'x'.repeat(10_001) },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(upsertMock).toHaveBeenCalledWith({ id: '1', column_state: 'x'.repeat(10_001) })
  })

  it('discards an oversized column_state on PATCH instead of uploading it', async () => {
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PATCH,
          table: 'user_table_preferences',
          id: '1',
          opData: { column_state: 'x'.repeat(10_001) },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(updateMock).toHaveBeenCalledWith({ column_state: {} })
    expect(complete).toHaveBeenCalled()
  })

  it('leaves a json column alone on a PATCH that does not include it', async () => {
    // A PATCH carries only the columns that changed, so user_table_preferences
    // ops without column_state are routine - decoding must not invent a value
    // for an absent column or choke on its absence.
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PATCH,
          table: 'user_table_preferences',
          id: '1',
          opData: { table_name: 'programs' },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(updateMock).toHaveBeenCalledWith({ table_name: 'programs' })
  })

  it('updates on PATCH', async () => {
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [
        makeCrudEntry({
          op: UpdateType.PATCH,
          table: 'dances',
          id: '1',
          opData: { title: 'Renamed' },
        }),
      ],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(updateMock).toHaveBeenCalledWith({ title: 'Renamed' })
    expect(eqMock).toHaveBeenCalledWith('id', '1')
    expect(complete).toHaveBeenCalled()
  })

  it('treats missing opData on PATCH as an empty update, not a crash', async () => {
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [makeCrudEntry({ op: UpdateType.PATCH, table: 'dances', id: '1', opData: undefined })],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(updateMock).toHaveBeenCalledWith({})
  })

  it('deletes on DELETE', async () => {
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [makeCrudEntry({ op: UpdateType.DELETE, table: 'dances', id: '1', opData: undefined })],
      complete,
    )

    await connector.uploadData(makeDatabase(transaction))

    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('id', '1')
    expect(complete).toHaveBeenCalled()
  })

  it('throws instead of completing the transaction when Supabase returns an error', async () => {
    // The specific bug this guards against: supabase-js returns { error }
    // rather than throwing, so a missed check here would silently drop the
    // failed write instead of surfacing it for PowerSync to retry.
    const complete = vi.fn(() => Promise.resolve())
    const transaction = new CrudTransaction(
      [makeCrudEntry({ op: UpdateType.PUT, table: 'dances', id: '1', opData: { title: 'X' } })],
      complete,
    )
    upsertMock.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(connector.uploadData(makeDatabase(transaction))).rejects.toEqual({
      message: 'permission denied',
    })
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('SupabaseConnector.fetchCredentials', () => {
  let connector: SupabaseConnector

  beforeEach(() => {
    connector = new SupabaseConnector()
    getSessionMock.mockClear()
  })

  it('returns the endpoint and access token from the current session', async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: 'abc123' } },
    })

    const credentials = await connector.fetchCredentials()

    expect(credentials.token).toBe('abc123')
    // Self-referential rather than a hardcoded URL: this checks
    // fetchCredentials() actually reads and returns the configured value,
    // not that the value happens to match some string written into the test.
    expect(credentials.endpoint).toBe(import.meta.env.VITE_POWERSYNC_URL)
  })

  it('throws when there is no active session', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } })

    // db.connect() should only ever be called once signed in (see
    // PowerSyncProvider), so reaching here with no session means that
    // invariant broke - this must surface loudly, not silently sync as an
    // unauthenticated request.
    await expect(connector.fetchCredentials()).rejects.toThrow(
      'fetchCredentials() called with no active Supabase session',
    )
  })
})