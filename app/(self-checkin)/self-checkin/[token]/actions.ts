'use server'

import { verifyStationToken } from '@/lib/station-token'
import {
  createCheckin,
  createStamp,
  getStationSponsorId,
  hasCheckinForEvent,
  lookupByBib,
} from '@/db/queries/checkins'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'

export async function performSelfCheckin(input: {
  token: string
  bibNumber: string
}): Promise<CheckinResult> {
  const payload = await verifyStationToken(input.token)
  if (!payload) return { found: false, error: 'QR Code หมดอายุหรือไม่ถูกต้อง' }

  const { stationId, eventId } = payload
  const registration = await lookupByBib(input.bibNumber.trim(), eventId)
  if (!registration) return { found: false }

  const { athleteId, firstName, lastName, profileImageUrl } = registration
  const isDuplicate = await hasCheckinForEvent(athleteId, eventId)

  await createCheckin({
    athleteId,
    stationId,
    eventId,
    bibNumber: registration.bibNumber,
    isNewAthlete: false,
    isDuplicate,
  })

  if (!isDuplicate) {
    const sponsorId = await getStationSponsorId(stationId)
    if (sponsorId) {
      await createStamp({ athleteId, eventId, stationId, sponsorId, stampSource: 'check_in' })
    }
  }

  return { found: true, isDuplicate, athlete: { firstName, lastName, profileImageUrl } }
}
