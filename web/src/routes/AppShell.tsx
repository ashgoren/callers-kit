import { CircleUserRound } from 'lucide-react'
import { NavLink, Outlet, useBeforeUnload, useBlocker } from 'react-router'
import { useStatus } from '@powersync/react'
import { useEffect, useState } from 'react'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { hasUnsavedRichText } from '@/lib/unsavedRichText'
import type { Theme } from '@/contexts/ThemeContext'

const THEMES: Theme[] = ['light', 'dark', 'system']
const NAV_LINKS = [
  { to: '/dances', label: 'Dances' },
  { to: '/programs', label: 'Programs' },
]

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
  // resolves almost instantly on a normal refresh, so just a spinner is
  // shown at first; the more detailed explanation only appears once loading
  // has actually taken a few seconds, which only happens for a genuinely
  // slow first sync (or a real connection problem) - never for that brief,
  // ordinary-refresh flash.
  const [showSlowSyncMessage, setShowSlowSyncMessage] = useState(false)

  // Guards against navigating away while a large Tiptap field (notes/
  // walkthrough) has unsaved changes open - those fields use an explicit
  // Save/Cancel model specifically so nothing commits without the user
  // asking for it, which means (unlike every blur-commit field, where
  // leaving already triggers a real commit) there's a genuine window where
  // leaving would silently lose an edit. hasUnsavedRichText() is a plain,
  // non-reactive registry (see src/lib/unsavedRichText.ts) - both hooks
  // below re-check it live at the moment a navigation is actually
  // attempted, not from some snapshot taken when AppShell last rendered.
  const blocker = useBlocker(() => hasUnsavedRichText())
  useBeforeUnload((event) => {
    if (hasUnsavedRichText()) {
      event.preventDefault()
    }
  })

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
      <header className="grid grid-cols-3 items-center border-b px-4 py-2">
        <span className="text-sm font-light">Caller's Kit</span>

        <nav className="flex items-center justify-center gap-3">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `text-sm ${isActive ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <DropdownMenu>
          {/* Icon-only trigger, not the email itself - on narrow screens the
              email text was long enough to overlap the nav links next to
              it. The identity display moves into the menu content below. */}
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="justify-self-end rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CircleUserRound className="size-5" />
          </DropdownMenuTrigger>
          {/* w-auto: sizes to its content (still floored by the default
              min-w-32) instead of matching its icon-sized trigger's width -
              narrow for a short email, wider only if one actually needs it. */}
          <DropdownMenuContent align="end" className="w-auto">
            {/* user?.email is the placeholder identity display until real
                user profiles exist — swap for e.g. user?.displayName ??
                user?.email here once one does. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
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
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <Spinner className="size-6 text-muted-foreground" />
            {showSlowSyncMessage && (
              <p className="text-muted-foreground text-sm">
                Still loading your data - this can take up to a minute on a new device…
              </p>
            )}
          </div>
        )}
      </main>

      <UnsavedChangesDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        description="You have an open note with unsaved changes. Leaving now will discard them."
        confirmLabel="Leave"
        onStay={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  )
}
