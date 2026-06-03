'use server'

import { auth } from '@/auth'
import {
  createCheckin,
  createStamp,
  getStationSponsorId,
  hasCheckinForEvent,
  lookupByBib,
} from '@/db/queries/checkins'
import { PERMISSIONS, canAccess } from '@/lib/rbac'
import type { CheckinResult } from './types'

export async function performCheckin(input: {
  bibNumber: string
  stationId: string
  eventId: string
}): Promise<CheckinResult> {
  // 1. Auth & permission check
  const session = await auth()
  if (!session?.user) {
    return { found: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  const authz = {
    role: session.user.role,
    permissions: session.user.permissions,
  }

  if (!canAccess(PERMISSIONS.CHECKIN_CREATE, authz)) {
    return { found: false, error: 'ไม่มีสิทธิ์ใช้งานฟีเจอร์นี้' }
  }

  const { bibNumber, stationId, eventId } = input

  // 2. Look up athlete by BIB
  const registration = await lookupByBib(bibNumber.trim(), eventId)
  if (!registration) {
    return { found: false }
  }

  const { athleteId, firstName, lastName, profileImageUrl } = registration

  // 3. Check for prior check-in (must happen BEFORE createCheckin)
  const isDuplicate = await hasCheckinForEvent(athleteId, eventId)

  // 4. Record the check-in
  await createCheckin({
    athleteId,
    stationId,
    eventId,
    bibNumber: registration.bibNumber,
    isNewAthlete: false, // Import context not available at check-in time
    isDuplicate,
  })

  // 5. Issue stamp on first check-in only
  if (!isDuplicate) {
    const sponsorId = await getStationSponsorId(stationId)
    if (sponsorId) {
      await createStamp({
        athleteId,
        eventId,
        stationId,
        sponsorId,
        stampSource: 'check_in',
      })
    }
  }

  return {
    found: true,
    isDuplicate,
    athlete: { firstName, lastName, profileImageUrl },
  }
}
