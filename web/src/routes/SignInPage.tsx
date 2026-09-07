import { useActionState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell } from '@/routes/AuthShell'
import { signInSchema } from './SignInPage.schema'

interface SignInState {
  error: string | null
}

export function SignInPage() {
  const { user, authLoading, signIn } = useAuth()
  const navigate = useNavigate()

  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    async (_prevState, formData) => {
      const result = signInSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
      })
      if (!result.success) {
        return { error: result.error.issues[0].message }
      }

      try {
        await signIn(result.data.email, result.data.password)
      } catch {
        return { error: 'Invalid email or password' }
      }

      void navigate('/')
      return { error: null }
    },
    { error: null },
  )

  if (!authLoading && user) return <Navigate to="/" replace />

  return (
    <AuthShell title="Sign in" subtitle="Caller's Kit">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isPending}
          />
        </div>

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex justify-between text-sm">
        <Link
          to="/forgot-password"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <Link
          to="/signup"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </div>
    </AuthShell>
  )
}
