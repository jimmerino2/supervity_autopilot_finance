// frontend/src/app/api/auth/[...nextauth]/route.ts
// Email-only login against the `approval_matrix` table — no passwords.
// Whatever email the user enters is looked up as `approver_email`; a match
// signs them in as that approver, carrying their approval limits into the session.

import NextAuth, { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

interface ApprovalMatrixRecord {
  approval_matrix_id: number
  role: string
  approver_name: string
  approver_email: string
  min_amount: number
  max_amount: number
  cost_center: string
}

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'approver-login',
      name: 'Approver Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim()
        if (!email) return null

        const response = await fetch(
          `${API_URL}${BASE_PATH}/api/approval_matrix/?approver_email=${encodeURIComponent(email)}`,
          { cache: 'no-store' }
        )
        if (!response.ok) return null

        const matches: ApprovalMatrixRecord[] = await response.json()
        const approver = matches[0]
        if (!approver) return null

        return {
          id: String(approver.approval_matrix_id),
          name: approver.approver_name,
          email: approver.approver_email,
          role: approver.role,
          minAmount: approver.min_amount,
          maxAmount: approver.max_amount,
          costCenter: approver.cost_center,
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.minAmount = user.minAmount
        token.maxAmount = user.maxAmount
        token.costCenter = user.costCenter
      }
      // All signed-in approvers get admin+user roles — this app doesn't yet
      // gate page access by approval_matrix.role, only the pay/bill action
      // by amount range.
      token.roles = ['admin', 'user']
      return token
    },
    async session({ session, token }) {
      session.roles = (token.roles as string[]) || ['admin', 'user']
      if (session.user) {
        session.user.role = token.role as string | undefined
        session.user.minAmount = token.minAmount as number | undefined
        session.user.maxAmount = token.maxAmount as number | undefined
        session.user.costCenter = token.costCenter as string | undefined
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-me',
  debug: false,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
