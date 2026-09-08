import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { usePowerSync } from '@powersync/react'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}))

vi.mock('./database', () => ({
  // Resolves by default, since most tests don't care about connect()'s
  // outcome - the error-path test below overrides this per-call with
  // mockRejectedValueOnce/mockResolvedValueOnce.
  db: { connect: vi.fn().mockResolvedValue(undefined) },
}))

// The real `db` export is a PowerSyncDatabase instance, so TypeScript infers
// `import('./database').db` at that type regardless of the vi.mock() above
// swapping its runtime value - and PowerSyncDatabase#connect, being a real
// class method, carries an implicit `this` that trips @typescript-eslint/
// unbound-method wherever we pass `db.connect` around as a bare reference
// below. This type describes what the mock actually is at runtime, decoupling
// `db` from the real class so `.connect` is just a plain mock function.
interface MockDb {
  connect: ReturnType<typeof vi.fn>
}

// db and PowerSyncProvider are both re-imported fresh, inside each test,
// after vi.resetModules(). PowerSyncProvider's `hasConnected` guard is
// module-level state with no exported way to reset it (deliberately - it's
// not meant to be resettable in real usage), so a fresh module instance per
// test is the only way to test each branch in isolation. Both have to come
// from the SAME fresh module graph, or the `db.connect` mock referenced here
// and the one PowerSyncProvider actually calls internally end up being two
// different mock functions after the reset - vi.mock()'s factory re-runs on
// every fresh import, producing a new vi.fn() each time.
async function loadFresh() {
  vi.resetModules()
  const { db } = await import('./database')
  const { PowerSyncProvider } = await import('./PowerSyncProvider')
  return { db: db as unknown as MockDb, PowerSyncProvider }
}

function ContextConsumer({ expected }: { expected: unknown }) {
  const powersync = usePowerSync()
  return <div>{powersync === expected ? 'has db' : 'no db'}</div>
}

describe('PowerSyncProvider', () => {
  it('provides db via PowerSyncContext regardless of auth state', async () => {
    useAuthMock.mockReturnValue({ user: null })
    const { db, PowerSyncProvider } = await loadFresh()

    render(
      <PowerSyncProvider>
        <ContextConsumer expected={db} />
      </PowerSyncProvider>,
    )

    expect(screen.getByText('has db')).toBeInTheDocument()
  })

  it('does not connect when signed out', async () => {
    useAuthMock.mockReturnValue({ user: null })
    const { db, PowerSyncProvider } = await loadFresh()

    render(
      <PowerSyncProvider>
        <div />
      </PowerSyncProvider>,
    )

    expect(db.connect).not.toHaveBeenCalled()
  })

  it('connects exactly once when a user is signed in, with a connector implementing fetchCredentials/uploadData', async () => {
    useAuthMock.mockReturnValue({ user: { id: '1' } })
    const { db, PowerSyncProvider } = await loadFresh()

    render(
      <PowerSyncProvider>
        <div />
      </PowerSyncProvider>,
    )

    expect(db.connect).toHaveBeenCalledTimes(1)
    // expect.any() is typed `any` by design, so it's assignable against any
    // expected shape - that's inherent to the asymmetric-matcher API, not a
    // real type-safety gap here.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(db.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchCredentials: expect.any(Function),
        uploadData: expect.any(Function),
      }),
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  })

  it('shows a retryable error instead of hanging forever when connect() rejects', async () => {
    useAuthMock.mockReturnValue({ user: { id: '1' } })
    const { db, PowerSyncProvider } = await loadFresh()
    db.connect.mockRejectedValueOnce(new Error('OPFS unavailable')).mockResolvedValueOnce(undefined)
    // Silence the deliberate console.error the component logs alongside
    // setting error state - this test is asserting on that state, not on
    // whether the console stays clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <PowerSyncProvider>
        <ContextConsumer expected={db} />
      </PowerSyncProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('OPFS unavailable')
    expect(screen.queryByText('has db')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    // Retry succeeds (the second mockResolvedValueOnce above) and renders
    // children again, proving the module-level hasConnected guard was
    // actually reset by the first failure - otherwise this second attempt
    // would silently no-op and the error would never clear.
    expect(await screen.findByText('has db')).toBeInTheDocument()
    expect(db.connect).toHaveBeenCalledTimes(2)
  })

  it('does not reconnect across an unmount/remount of the same module instance', async () => {
    useAuthMock.mockReturnValue({ user: { id: '1' } })
    const { db, PowerSyncProvider } = await loadFresh()

    const { unmount } = render(
      <PowerSyncProvider>
        <div />
      </PowerSyncProvider>,
    )
    unmount()

    render(
      <PowerSyncProvider>
        <div />
      </PowerSyncProvider>,
    )

    expect(db.connect).toHaveBeenCalledTimes(1)
  })
})
