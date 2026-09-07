import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CrudTransaction, UpdateType } from '@powersync/web'
import type { CommonPowerSyncDatabase, CrudEntry } from '@powersync/web'
import { SupabaseConnector } from './connector'

// supabase.from(table) returns a chainable query builder — .upsert() and
// .eq() (after .update()/.delete()) are the only calls our connector code
// actually makes, so that's all that's faked here.
//
// vi.hoisted() is required here (unlike commitFieldEdit.test.ts's simpler
// mock): vi.mock()'s factory is hoisted above regular `const` declarations,
// so without this, the factory below would reference fromMock before it's
// initialized. vi.hoisted() hoists this block too, so the mocks exist by
// the time vi.mock()'s factory runs.
const { fromMock, upsertMock, updateMock, deleteMock, eqMock, getSessionMock } = vi.hoisted(() => {
  const eqMock = vi.fn(() => ({ error: null as { message: string } | null }))
  const upsertMock = vi.fn(() => ({ error: null as { message: string } | null }))
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const deleteMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({
    upsert: upsertMock,
    update: updateMock,
    delete: deleteMock,
  }))
  // Real getSession() resolves { data: { session } }, session null when
  // signed out — matched here so fetchCredentials() can be tested against
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
// — it only reads .op/.table/.id/.opData. Faked minimally here and cast past
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
    // invariant broke — this must surface loudly, not silently sync as an
    // unauthenticated request.
    await expect(connector.fetchCredentials()).rejects.toThrow(
      'fetchCredentials() called with no active Supabase session',
    )
  })
})
