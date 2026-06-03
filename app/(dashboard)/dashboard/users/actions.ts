'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { auth } from '@/auth'
import type { UserRole } from '@/lib/rbac'
import {
  createUser,
  disableUser,
  getUser,
  updateUser,
} from '@/db/queries/users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserActionState =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> }
  | undefined

// Roles that each creator role is allowed to assign
const ALLOWED_ROLES_BY_CREATOR: Record<string, UserRole[]> = {
  super_admin_owner: [
    'super_admin_owner',
    'super_admin_manager',
    'super_admin_viewer',
    'sponsor_admin',
    'sponsor_staff',
  ],
  super_admin_manager: ['super_admin_viewer', 'sponsor_admin', 'sponsor_staff'],
  sponsor_admin: ['sponsor_staff'],
}

// Roles that belong to MACIM (no sponsorId required)
const MACIM_ROLES: UserRole[] = [
  'super_admin_owner',
  'super_admin_manager',
  'super_admin_viewer',
]

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email: z.email({ error: 'อีเมลไม่ถูกต้อง' }),
  password: z.string().min(8, { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }),
  phoneNumber: z.string().optional(),
  role: z.enum([
    'super_admin_owner',
    'super_admin_manager',
    'super_admin_viewer',
    'sponsor_admin',
    'sponsor_staff',
  ]),
  sponsorId: z.string().optional(),
})

const updateUserSchema = z.object({
  email: z.email({ error: 'อีเมลไม่ถูกต้อง' }),
  phoneNumber: z.string().optional(),
})

// ---------------------------------------------------------------------------
// createUserAction
// ---------------------------------------------------------------------------

export async function createUserAction(
  prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await auth()
  if (!session?.user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  const creatorRole = session.user.role

  // Only those with user:manage or user:manage_staff can create
  if (
    !session.user.permissions.includes('user:manage') &&
    !session.user.permissions.includes('user:manage_staff')
  ) {
    return { error: 'ไม่มีสิทธิ์สร้างผู้ใช้' }
  }

  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    phoneNumber: formData.get('phoneNumber') || undefined,
    role: formData.get('role'),
    sponsorId: formData.get('sponsorId') || undefined,
  }

  const parsed = createUserSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const { email, password, phoneNumber, role } = parsed.data

  // Enforce creator role → allowed target roles
  const allowedRoles = ALLOWED_ROLES_BY_CREATOR[creatorRole] ?? []
  if (!allowedRoles.includes(role)) {
    return { error: `ไม่มีสิทธิ์สร้างผู้ใช้บทบาท "${role}"` }
  }

  // Determine sponsorId
  let resolvedSponsorId: string | null = null
  if (creatorRole === 'sponsor_admin') {
    // Force own sponsorId; ignore any posted value
    resolvedSponsorId = session.user.sponsorId
  } else if (!MACIM_ROLES.includes(role)) {
    // sponsor_admin / sponsor_staff need a sponsorId
    const postedSponsorId = parsed.data.sponsorId
    if (!postedSponsorId) {
      return {
        error: 'กรุณาเลือก Sponsor สำหรับบทบาทนี้',
        fieldErrors: { sponsorId: ['จำเป็นต้องเลือก Sponsor'] },
      }
    }
    resolvedSponsorId = postedSponsorId
  }

  const passwordHash = await hash(password, 12)

  try {
    await createUser({
      email,
      passwordHash,
      role,
      sponsorId: resolvedSponsorId,
      phoneNumber: phoneNumber || null,
    })
  } catch (err) {
    // Unique constraint on email
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return {
        error: 'อีเมลนี้มีอยู่ในระบบแล้ว',
        fieldErrors: { email: ['อีเมลนี้มีอยู่ในระบบแล้ว'] },
      }
    }
    throw err
  }

  revalidatePath('/users')
  redirect('/users')
}

// ---------------------------------------------------------------------------
// updateUserAction  (bound: updateUserAction.bind(null, userId))
// ---------------------------------------------------------------------------

export async function updateUserAction(
  userId: string,
  prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await auth()
  if (!session?.user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  if (
    !session.user.permissions.includes('user:manage') &&
    !session.user.permissions.includes('user:manage_staff')
  ) {
    return { error: 'ไม่มีสิทธิ์แก้ไขผู้ใช้' }
  }

  // Scope check: sponsor_admin can only edit users in their own sponsor
  if (session.user.role === 'sponsor_admin') {
    const target = await getUser(userId)
    if (!target) return { error: 'ไม่พบผู้ใช้' }
    if (target.sponsorId !== session.user.sponsorId) {
      return { error: 'ไม่มีสิทธิ์แก้ไขผู้ใช้นี้' }
    }
  }

  const raw = {
    email: formData.get('email'),
    phoneNumber: formData.get('phoneNumber') || undefined,
  }

  const parsed = updateUserSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const { email, phoneNumber } = parsed.data

  try {
    await updateUser(userId, {
      email,
      phoneNumber: phoneNumber || null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return {
        error: 'อีเมลนี้มีอยู่ในระบบแล้ว',
        fieldErrors: { email: ['อีเมลนี้มีอยู่ในระบบแล้ว'] },
      }
    }
    throw err
  }

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// disableUserAction
// ---------------------------------------------------------------------------

export async function disableUserAction(
  userId: string,
  _prevState: UserActionState,
  _formData?: FormData,
): Promise<UserActionState> {
  const session = await auth()
  if (!session?.user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  if (
    !session.user.permissions.includes('user:manage') &&
    !session.user.permissions.includes('user:manage_staff')
  ) {
    return { error: 'ไม่มีสิทธิ์ปิดใช้งานผู้ใช้' }
  }

  // Scope check: sponsor_admin can only disable users in their own sponsor
  if (session.user.role === 'sponsor_admin') {
    const target = await getUser(userId)
    if (!target) return { error: 'ไม่พบผู้ใช้' }
    if (target.sponsorId !== session.user.sponsorId) {
      return { error: 'ไม่มีสิทธิ์ปิดใช้งานผู้ใช้นี้' }
    }
  }

  await disableUser(userId)

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  return { success: true }
}
