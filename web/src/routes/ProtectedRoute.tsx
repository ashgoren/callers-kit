import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/signin" replace />

  return <Outlet />
}
