import { cache } from 'react'
import NextAuth from 'next-auth'
import type {} from 'next-auth/jwt'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema/users'
import { loadSessionAuthz } from '@/db/queries/authz'
import { authConfig } from './auth.config'
import type { UserRole } from '@/lib/rbac'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      role: UserRole
      sponsorId: string | null
      permissions: string[]
    }
  }
  interface User {
    role: UserRole
    sponsorId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role: UserRole
    sponsorId: string | null
    permissions: string[]
    userValidatedAt?: number
  }
}

const USER_VALIDATION_TTL_MS = 5 * 60 * 1000

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

const nextAuth = NextAuth({
  ...authConfig,
  debug: process.env.NODE_ENV !== 'production',
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        if (!user || user.status !== 'active') return null

        const valid = await compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.userId,
          email: user.email,
          role: user.role,
          sponsorId: user.sponsorId,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      const userId = user?.id ?? token.userId
      if (!userId) return token

      const isSignIn = !!user?.id
      const isUpdate = trigger === 'update'
      const isStale = !token.role
      const lastValidated = token.userValidatedAt ?? 0
      const ttlExpired = Date.now() - lastValidated > USER_VALIDATION_TTL_MS

      if (isSignIn) {
        // authorize() already verified — trust user object, still validate status
        const authz = await loadSessionAuthz(userId)
        if (!authz.exists || authz.disabled) return null
        token.userId = userId
        token.role = user.role
        token.sponsorId = user.sponsorId
        token.permissions = authz.permissions
        token.userValidatedAt = Date.now()
      } else if (isUpdate || isStale || ttlExpired) {
        const authz = await loadSessionAuthz(userId)
        if (!authz.exists || authz.disabled) return null
        token.userId = userId
        token.role = authz.role
        token.sponsorId = authz.sponsorId
        token.permissions = authz.permissions
        token.userValidatedAt = Date.now()
      }

      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId
      session.user.role = token.role
      session.user.sponsorId = token.sponsorId
      session.user.permissions = token.permissions
      return session
    },
  },
})

export const { handlers, signIn, signOut } = nextAuth
export const auth = cache(nextAuth.auth)
