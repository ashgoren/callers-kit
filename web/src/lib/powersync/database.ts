import { PowerSyncDatabase, WASQLiteVFS } from '@powersync/web'
import { AppSchema } from './schema'

// The local SQLite database for the whole app. Created once, at module
// scope - NOT inside a React component or useEffect. A module is only ever
// evaluated once per page load, so this naturally gives exactly one shared
// instance no matter how many times components using it get mounted and
// unmounted, which happens twice on every mount in React Strict Mode (dev
// builds only). Creating it inside a useEffect instead would break sync in
// dev: the first mount's cleanup would tear down the shared worker/database
// connection before the second mount could use it.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    // Filename PowerSync uses for the local SQLite database.
    dbFilename: 'callers-kit.db',
    // OPFS instead of the IndexedDB-backed default: faster (no async
    // per-page-read overhead), avoids a known IndexedDB-VFS crash on large
    // Safari queries, and is PowerSync's own recommended VFS for Safari/iOS
    // multi-tab support specifically - relevant since iPad is a real target
    // platform for this app, not an afterthought. The one gap is private/
    // incognito browsing, which doesn't support OPFS at all in most
    // non-Chromium browsers; no fallback to IDBBatchAtomicVFS is implemented for that case yet.
    //
    // (A Safari-slowness investigation - initial sync taking 15-30s in
    // Safari vs ~1s in Chrome & Firefox on the same device & network - tested
    // AccessHandlePoolVFS and IDBBatchAtomicVFS here too. Both landed in the
    // same 20s range, ruling out VFS/storage-backend choice as the cause.)
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
  },
})
