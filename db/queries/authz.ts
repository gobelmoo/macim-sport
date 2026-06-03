import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema/users'
import { getPermissionsForRole } from '@/lib/rbac'
import type { UserRole } from '@/lib/rbac'

export interface SessionAuthz {
  exists: boolean
  disabled: boolean
  role: UserRole
  sponsorId: string | null
  permissions: string[]
}

// Single round-trip: existence + disabled + role + permissions
export async function loadSessionAuthz(userId: string): Promise<SessionAuthz> {
  const [user] = await db
    .select({
      status: users.status,
      role: users.role,
      sponsorId: users.sponsorId,
    })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1)

  if (!user) {
    return {
      exists: false,
      disabled: false,
      role: 'super_admin_viewer',
      sponsorId: null,
      permissions: [],
    }
  }

  return {
    exists: true,
    disabled: user.status !== 'active',
    role: user.role,
    sponsorId: user.sponsorId,
    permissions: getPermissionsForRole(user.role),
  }
}
