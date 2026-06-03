'use server'

import { verifyStationToken } from '@/lib/station-token'
import { executeCheckin } from '@/lib/checkin-core'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'

export async function performSelfCheckin(input: {
  token: string
  bibNumber: string
}): Promise<CheckinResult> {
  const payload = await verifyStationToken(input.token)
  if (!payload) return { found: false, error: 'QR Code หมดอายุหรือไม่ถูกต้อง' }

  return executeCheckin({
    bibNumber: input.bibNumber,
    stationId: payload.stationId,
    eventId: payload.eventId,
  })
}
