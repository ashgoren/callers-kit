import { Navigate, Outlet } from 'react-router'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { PowerSyncProvider } from '@/lib/powersync/PowerSyncProvider'

export function ProtectedRoute() {
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (!user) return <Navigate to="/signin" replace />

  return (
    <PowerSyncProvider>
      <Outlet />
    </PowerSyncProvider>
  )
}
