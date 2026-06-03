'use server'

import { auth } from '@/auth'
import { PERMISSIONS, canAccess } from '@/lib/rbac'
import { executeCheckin } from '@/lib/checkin-core'
import type { CheckinResult } from './types'

export async function performCheckin(input: {
  bibNumber: string
  stationId: string
  eventId: string
}): Promise<CheckinResult> {
  const session = await auth()
  if (!session?.user) return { found: false, error: 'ไม่ได้เข้าสู่ระบบ' }

  if (!canAccess(PERMISSIONS.CHECKIN_CREATE, { role: session.user.role, permissions: session.user.permissions })) {
    return { found: false, error: 'ไม่มีสิทธิ์ใช้งานฟีเจอร์นี้' }
  }

  return executeCheckin(input)
}
