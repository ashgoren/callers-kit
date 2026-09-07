import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export function HomePage() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <p className="text-sm">
        Signed in as <span className="font-medium">{user?.email}</span>
      </p>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
