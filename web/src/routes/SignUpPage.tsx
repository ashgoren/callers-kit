import { useActionState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell } from '@/routes/AuthShell'

const signUpSchema = z
  .object({
    email: z.email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

interface SignUpState {
  error: string | null
  email: string | null
}

export function SignUpPage() {
  const { signUp } = useAuth()

  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    async (_prevState, formData) => {
      const result = signUpSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
      })
      if (!result.success) {
        return { error: result.error.issues[0].message, email: null }
      }

      try {
        await signUp(result.data.email, result.data.password)
      } catch {
        return {
          error: 'Could not create account. That email may already be in use.',
          email: null,
        }
      }

      return { error: null, email: result.data.email }
    },
    { error: null, email: null },
  )

  if (state.email) {
    return (
      <AuthShell title="Check your email">
        <p className="text-muted-foreground text-center text-sm">
          We sent a confirmation link to <span className="font-medium">{state.email}</span>. Click it to
          activate your account, then sign in.
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
    <AuthShell title="Create account">
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
            autoComplete="new-password"
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
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
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link to="/signin" className="hover:text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
