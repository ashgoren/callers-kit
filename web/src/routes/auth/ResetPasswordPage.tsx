import { useActionState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { AuthShell } from './AuthShell'
import { resetPasswordSchema } from './ResetPasswordPage.schema'

interface ResetPasswordState {
  error: string | null
}

export function ResetPasswordPage() {
  const navigate = useNavigate()

  const [state, formAction, isPending] = useActionState<ResetPasswordState, FormData>(
    async (_prevState, formData) => {
      const result = resetPasswordSchema.safeParse({
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
      })
      if (!result.success) {
        return { error: result.error.issues[0].message }
      }

      const { error } = await supabase.auth.updateUser({ password: result.data.password })
      if (error) {
        return { error: 'Could not update password. Your reset link may have expired.' }
      }

      void navigate('/signin')
      return { error: null }
    },
    { error: null },
  )

  return (
    <AuthShell title="Set new password">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
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
          {isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  )
}
