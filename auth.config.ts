import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/sign-in',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const path = request.nextUrl.pathname

      if (path.startsWith('/sign-in')) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', request.nextUrl))
        }
        return true
      }

      // Self check-in is public — no login required
      if (path.startsWith('/self-checkin')) return true

      if (
        path.startsWith('/dashboard') ||
        path.startsWith('/checkin') ||
        path === '/'
      ) {
        return isLoggedIn
      }

      return true
    },
  },
} satisfies NextAuthConfig
