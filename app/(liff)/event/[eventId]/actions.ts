'use server'

import { getAthleteByLineUserId, getRegistrationByAthleteAndEvent } from '@/db/queries/line'
import { verifyLiffIdToken } from '@/lib/line-client'

export async function checkRegistrationAction(
  idToken: string,
  eventId: string,
): Promise<{ registered: boolean; bibNumber?: string }> {
  const lineUserId = await verifyLiffIdToken(idToken)
  if (!lineUserId) return { registered: false }

  const athlete = await getAthleteByLineUserId(lineUserId)
  if (!athlete) return { registered: false }

  const reg = await getRegistrationByAthleteAndEvent(athlete.athleteId, eventId)
  if (!reg) return { registered: false }

  return { registered: true, bibNumber: reg.bibNumber }
}
