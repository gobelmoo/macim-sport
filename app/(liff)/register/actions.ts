'use server'

import { verifyLiffIdToken, pushMessage } from '@/lib/line-client'
import {
  createAthleteAndRegistration,
  createRegistrationForExistingAthlete,
  getAthleteByLineUserId,
  getEventById,
  insertAthleteConsent,
} from '@/db/queries/line'
import { successMessage } from '@/lib/line-messages'
import { isValidBib } from '@/lib/line-state'

export type RegisterState =
  | null
  | { ok: true; firstName: string; bib: string; eventName: string }
  | { ok: false; error: string }

export async function registerViaLine(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const liffIdToken = formData.get('liffIdToken') as string
  const eventId = formData.get('eventId') as string
  const bib = (formData.get('bib') as string).trim()
  const firstName = (formData.get('firstName') as string).trim()
  const lastName = (formData.get('lastName') as string).trim()
  const dateOfBirth = formData.get('dateOfBirth') as string
  const gender = formData.get('gender') as 'male' | 'female' | 'other'

  if (!liffIdToken) {
    return { ok: false, error: 'ไม่พบ ID Token กรุณาเปิดผ่าน LINE ใหม่อีกครั้ง' }
  }

  if (!bib || !firstName || !lastName || !dateOfBirth || !gender) {
    return { ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
  }

  if (!isValidBib(bib)) {
    return { ok: false, error: 'หมายเลข BIB ไม่ถูกต้อง' }
  }

  let lineUserId: string
  try {
    lineUserId = await verifyLiffIdToken(liffIdToken)
  } catch {
    return { ok: false, error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่' }
  }

  const event = await getEventById(eventId)
  if (!event) return { ok: false, error: 'ไม่พบงาน' }

  try {
    const existing = await getAthleteByLineUserId(lineUserId)

    if (existing) {
      await createRegistrationForExistingAthlete({
        athleteId: existing.athleteId,
        eventId,
        bibNumber: bib,
      })
    } else {
      const { athleteId } = await createAthleteAndRegistration({
        lineUserId,
        eventId,
        bibNumber: bib,
        firstName,
        lastName,
        dateOfBirth,
        gender,
      })
      await insertAthleteConsent(athleteId)
    }
  } catch {
    return { ok: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }
  }

  // Push success message after DB writes succeed; don't fail registration if push fails
  try {
    await pushMessage(lineUserId, [successMessage(firstName, bib, event.eventName)])
  } catch {
    console.error('[registerViaLine] pushMessage failed for', lineUserId)
  }

  return { ok: true, firstName, bib, eventName: event.eventName }
}
