'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'

export type SignInState = { error: string } | undefined

export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
    }
    throw error
  }
}
