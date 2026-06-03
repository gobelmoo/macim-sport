import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema/users'
import { sponsors } from '@/db/schema/sponsors'
import type { UserRole } from '@/lib/rbac'

export type UserRow = typeof users.$inferSelect

export type UserWithSponsor = UserRow & {
  sponsorName: string | null
}

export type CreateUserData = {
  email: string
  passwordHash: string
  role: UserRole
  sponsorId?: string | null
  phoneNumber?: string | null
}

export type UpdateUserData = {
  email?: string
  phoneNumber?: string | null
}

export async function listUsers(opts?: {
  sponsorId?: string
}): Promise<UserWithSponsor[]> {
  const rows = await db
    .select({
      userId: users.userId,
      email: users.email,
      passwordHash: users.passwordHash,
      phoneNumber: users.phoneNumber,
      role: users.role,
      sponsorId: users.sponsorId,
      lineUserId: users.lineUserId,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      ipAddress: users.ipAddress,
      sponsorName: sponsors.sponsorName,
    })
    .from(users)
    .leftJoin(sponsors, eq(users.sponsorId, sponsors.sponsorId))
    .orderBy(desc(users.createdAt))

  if (opts?.sponsorId) {
    return rows
      .filter((r) => r.sponsorId === opts.sponsorId)
      .map((r) => ({ ...r, sponsorName: r.sponsorName ?? null }))
  }

  return rows.map((r) => ({ ...r, sponsorName: r.sponsorName ?? null }))
}

export async function getUser(
  userId: string,
): Promise<UserWithSponsor | null> {
  const [row] = await db
    .select({
      userId: users.userId,
      email: users.email,
      passwordHash: users.passwordHash,
      phoneNumber: users.phoneNumber,
      role: users.role,
      sponsorId: users.sponsorId,
      lineUserId: users.lineUserId,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      ipAddress: users.ipAddress,
      sponsorName: sponsors.sponsorName,
    })
    .from(users)
    .leftJoin(sponsors, eq(users.sponsorId, sponsors.sponsorId))
    .where(eq(users.userId, userId))
    .limit(1)

  if (!row) return null
  return { ...row, sponsorName: row.sponsorName ?? null }
}

export async function createUser(
  data: CreateUserData,
): Promise<{ userId: string }> {
  const [row] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      sponsorId: data.sponsorId ?? null,
      phoneNumber: data.phoneNumber ?? null,
    })
    .returning({ userId: users.userId })

  return row
}

export async function updateUser(
  userId: string,
  data: UpdateUserData,
): Promise<{ userId: string }> {
  const [row] = await db
    .update(users)
    .set(data)
    .where(eq(users.userId, userId))
    .returning({ userId: users.userId })

  return row
}

export async function disableUser(
  userId: string,
): Promise<{ userId: string }> {
  const [row] = await db
    .update(users)
    .set({ status: 'hidden' })
    .where(eq(users.userId, userId))
    .returning({ userId: users.userId })

  return row
}
