import { useActionState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell } from '@/routes/AuthShell'
import { forgotPasswordSchema } from './ForgotPasswordPage.schema'

interface ForgotPasswordState {
  error: string | null
  email: string | null
}

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()

  const [state, formAction, isPending] = useActionState<ForgotPasswordState, FormData>(
    async (_prevState, formData) => {
      const result = forgotPasswordSchema.safeParse({ email: formData.get('email') })
      if (!result.success) {
        return { error: result.error.issues[0].message, email: null }
      }

      try {
        await resetPassword(result.data.email)
      } catch {
        return { error: 'Could not send reset email. Please try again.', email: null }
      }

      return { error: null, email: result.data.email }
    },
    { error: null, email: null },
  )

  if (state.email) {
    return (
      <AuthShell title="Check your email">
        <p className="text-muted-foreground text-center text-sm">
          If an account exists for <span className="font-medium">{state.email}</span>, you'll receive a
          password reset link shortly.
        </p>
        <Link
          to="/signin"
          className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a reset link.">
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

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <Link
        to="/signin"
        className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </AuthShell>
  )
}
