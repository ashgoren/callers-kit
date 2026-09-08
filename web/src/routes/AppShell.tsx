import { Link, Outlet } from 'react-router'
import { useStatus } from '@powersync/react'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { Theme } from '@/contexts/ThemeContext'

const THEMES: Theme[] = ['light', 'dark', 'system']

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// Persistent chrome for every signed-in page - nested inside ProtectedRoute
// so it only ever renders once already authenticated. Kept separate from
// ProtectedRoute itself, which is only responsible for the auth gate and
// PowerSync connection, not page layout.
export function AppShell() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  // hasSynced is false until PowerSync's initial full sync completes - on a
  // brand new local database (first login on a new browser)
  // that's the first time real data exists locally at all.
  // Gated here, not per-page: virtually every page needs all tables
  // (choreographers/key_moves/vibes now, programs for filtering later), so
  // there's no real content any route could show before this is true anyway.
  const { hasSynced } = useStatus()

  // hasSynced starts undefined for a moment on every page load - even on an
  // already-synced device - while PowerSync reads its local, offline sync
  // status (a local-only SQL query, no network round trip needed). That
  // resolves almost instantly on a normal refresh, so a plain "Loading…" is
  // shown at first; the more detailed explanation only appears once loading
  // has actually taken a few seconds, which only happens for a genuinely
  // slow first sync (or a real connection problem) - never for that brief,
  // ordinary-refresh flash.
  const [showSlowSyncMessage, setShowSlowSyncMessage] = useState(false)

  useEffect(() => {
    if (hasSynced) return undefined

    const timeoutId = setTimeout(() => {
      setShowSlowSyncMessage(true)
    }, 3000)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [hasSynced])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <Link to="/" className="text-sm font-semibold">
          Caller's Kit
        </Link>

        <DropdownMenu>
          {/* user?.email is the placeholder identity display until real user
              profiles exist — swap for e.g. user?.displayName ?? user?.email
              here once one does. */}
          <DropdownMenuTrigger className="rounded-md px-2 py-1 text-sm hover:bg-muted">
            {user?.email}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value: Theme) => {
                    setTheme(value)
                  }}
                >
                  {THEMES.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {capitalize(option)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1">
        {hasSynced ? (
          <Outlet />
        ) : (
          <p className="text-muted-foreground p-4 text-center text-sm">
            {showSlowSyncMessage
              ? 'Still loading your data - this can take up to a minute on a new device…'
              : 'Loading…'}
          </p>
        )}
      </main>
    </div>
  )
}
