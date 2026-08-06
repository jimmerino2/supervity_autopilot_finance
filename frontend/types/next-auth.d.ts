// frontend/types/next-auth.d.ts
import NextAuth from 'next-auth'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    idToken?: string
    error?: string
    accessTokenExpires?: number
    roles?: string[]
    sub?: string  // User ID from Keycloak

    user?: {
      name?: string | null
      email?: string | null
      image?: string | null
      // approval_matrix fields, present when signed in via approver-login
      role?: string
      minAmount?: number
      maxAmount?: number
      costCenter?: string
    }
  }

  interface User {
    id?: string
    sub?: string
    // approval_matrix fields returned from the approver-login authorize()
    role?: string
    minAmount?: number
    maxAmount?: number
    costCenter?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    accessTokenExpires?: number
    refreshToken?: string
    error?: string
    idToken?: string
    role?: string
    minAmount?: number
    maxAmount?: number
    costCenter?: string
  }
}
