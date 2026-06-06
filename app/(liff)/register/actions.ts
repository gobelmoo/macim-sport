'use server'

import { verifyLiffIdToken, pushMessage } from '@/lib/line-client'
import {
  createAthleteAndRegistration,
  createRegistrationForExistingAthlete,
  getAthleteByLineUserId,
  getEventById,
  insertAthleteConsent,
  getRegistrationByAthleteAndEvent,
  updateAthleteProfile,
  updateRegistrationBib,
} from '@/db/queries/line'
import { successMessage } from '@/lib/line-messages'
import { isValidBib } from '@/lib/line-state'

export type RegisterState =
  | null
  | { ok: true; firstName: string; bib: string; eventName: string; updated: boolean }
  | { ok: false; error: string }

export async function fetchAthleteProfile(
  idToken: string,
  eventId: string,
): Promise<{
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  existingBib: string | null
} | null> {
  try {
    const lineUserId = await verifyLiffIdToken(idToken)
    const athlete = await getAthleteByLineUserId(lineUserId)
    if (!athlete) return null
    const reg = await getRegistrationByAthleteAndEvent(athlete.athleteId, eventId)
    return {
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      dateOfBirth: athlete.dateOfBirth,
      gender: athlete.gender,
      existingBib: reg?.bibNumber ?? null,
    }
  } catch {
    return null
  }
}

export async function fetchEventInfo(eventId: string): Promise<{
  eventName: string
  eventLogoUrl: string | null
  description: string | null
} | null> {
  try {
    const event = await getEventById(eventId)
    if (!event) return null
    return {
      eventName: event.eventName,
      eventLogoUrl: event.eventLogoUrl,
      description: event.description,
    }
  } catch {
    return null
  }
}

export async function registerViaLine(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const liffIdToken = formData.get('liffIdToken') as string
  const eventId = formData.get('eventId') as string
  const bib = (formData.get('bib') as string).trim().toUpperCase()
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return { ok: false, error: 'วันเกิดไม่ถูกต้อง' }
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
    const existingAthlete = await getAthleteByLineUserId(lineUserId)

    if (existingAthlete) {
      const existingReg = await getRegistrationByAthleteAndEvent(existingAthlete.athleteId, eventId)

      if (existingReg) {
        // Already registered for this event — update profile + BIB (no uniqueness check)
        await updateAthleteProfile(existingAthlete.athleteId, { firstName, lastName, dateOfBirth, gender })
        await updateRegistrationBib(existingAthlete.athleteId, eventId, bib)
        return { ok: true, updated: true, firstName, bib, eventName: event.eventName }
      }

      // Returning athlete, new event — create registration + update profile
      await createRegistrationForExistingAthlete({
        athleteId: existingAthlete.athleteId,
        eventId,
        bibNumber: bib,
      })
      await updateAthleteProfile(existingAthlete.athleteId, { firstName, lastName, dateOfBirth, gender })
      // fall through to push
      try {
        await pushMessage(lineUserId, [successMessage(firstName, bib, event.eventName)])
      } catch {
        console.error('[registerViaLine] pushMessage failed for', lineUserId)
      }
      return { ok: true, updated: false, firstName, bib, eventName: event.eventName }
    }

    // New athlete
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
    try {
      await pushMessage(lineUserId, [successMessage(firstName, bib, event.eventName)])
    } catch {
      console.error('[registerViaLine] pushMessage failed for', lineUserId)
    }
    return { ok: true, updated: false, firstName, bib, eventName: event.eventName }
  } catch {
    return { ok: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }
  }
}
