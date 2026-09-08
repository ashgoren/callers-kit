import { Link, Outlet } from 'react-router'
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
        <Outlet />
      </main>
    </div>
  )
}
