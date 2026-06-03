import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema/users'
import { sponsors } from '@/db/schema/sponsors'
import type { UserRole } from '@/lib/rbac'

export type UserRow = typeof users.$inferSelect

export type UserListItem = {
  userId: string
  email: string
  phoneNumber: string | null
  role: UserRole
  sponsorId: string | null
  lineUserId: string | null
  status: 'active' | 'hidden' | 'inactive'
  createdAt: Date
  lastLoginAt: Date | null
  sponsorName: string | null
}

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
}): Promise<UserListItem[]> {
  const rows = await db
    .select({
      userId: users.userId,
      email: users.email,
      phoneNumber: users.phoneNumber,
      role: users.role,
      sponsorId: users.sponsorId,
      lineUserId: users.lineUserId,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      sponsorName: sponsors.sponsorName,
    })
    .from(users)
    .leftJoin(sponsors, eq(users.sponsorId, sponsors.sponsorId))
    .where(opts?.sponsorId ? eq(users.sponsorId, opts.sponsorId) : undefined)
    .orderBy(desc(users.createdAt))

  return rows
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

  return row ?? null
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
    .set({ status: 'inactive' })
    .where(eq(users.userId, userId))
    .returning({ userId: users.userId })

  return row
}

export async function enableUser(
  userId: string,
): Promise<{ userId: string }> {
  const [row] = await db
    .update(users)
    .set({ status: 'active' })
    .where(eq(users.userId, userId))
    .returning({ userId: users.userId })

  return row
}
