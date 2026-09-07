import { describe, expect, it } from 'vitest'
import { forgotPasswordSchema } from './ForgotPasswordPage.schema'
import { resetPasswordSchema } from './ResetPasswordPage.schema'
import { signInSchema } from './SignInPage.schema'
import { signUpSchema } from './SignUpPage.schema'

// Validation-only tests for the auth pages' zod schemas — not component tests

describe('signInSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    const result = signInSchema.safeParse({ email: 'a@b.com', password: 'x' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: 'x' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const result = signInSchema.safeParse({ email: 'a@b.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('signUpSchema', () => {
  const valid = { email: 'a@b.com', password: 'abcdef', confirmPassword: 'abcdef' }

  it('accepts matching passwords of sufficient length', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a password shorter than 6 characters', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'abc', confirmPassword: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords, attributing the error to confirmPassword specifically', () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: 'different' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
      expect(result.error.issues[0].message).toBe('Passwords do not match')
    }
  })
})

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
  })

  it('rejects an invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  const valid = { password: 'abcdef', confirmPassword: 'abcdef' }

  it('accepts matching passwords of sufficient length', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects mismatched passwords, attributing the error to confirmPassword specifically', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, confirmPassword: 'different' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
      expect(result.error.issues[0].message).toBe('Passwords do not match')
    }
  })
})
