'use server'

import { verifyQueueToken } from '@/lib/queue-token'
import { verifyLiffIdToken, pushMessage } from '@/lib/line-client'
import { queueTicketMessage } from '@/lib/line-messages'
import { isValidBib } from '@/lib/line-state'
import { enqueue, getCounter } from '@/db/queries/queue'
import {
  getAthleteByLineUserId,
  getRegistrationByAthleteAndEvent,
  createAthleteAndRegistration,
  createRegistrationForExistingAthlete,
  insertAthleteConsent,
} from '@/db/queries/line'

const APP_BASE = (
  process.env.AUTH_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

export type QueueContext =
  | { ok: false; reason: 'invalid' | 'closed' }
  | {
      ok: true
      counterName: string
      // ready = ลงทะเบียนแล้ว ขอคิวได้เลย
      // need_bib = เป็นสมาชิกแต่ยังไม่ลงทะเบียน event นี้
      // need_profile = ยังไม่เป็นสมาชิก
      mode: 'ready' | 'need_bib' | 'need_profile'
    }

export async function getQueueContext(
  token: string,
  liffIdToken: string,
): Promise<QueueContext> {
  const payload = await verifyQueueToken(token)
  if (!payload) return { ok: false, reason: 'invalid' }
  const counter = await getCounter(payload.counterId)
  if (!counter || counter.eventId !== payload.eventId) {
    return { ok: false, reason: 'invalid' }
  }
  if (!counter.isOpen) return { ok: false, reason: 'closed' }

  let lineUserId: string
  try {
    lineUserId = await verifyLiffIdToken(liffIdToken)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  const athlete = await getAthleteByLineUserId(lineUserId)
  if (!athlete) {
    return { ok: true, counterName: counter.counterName, mode: 'need_profile' }
  }
  const reg = await getRegistrationByAthleteAndEvent(
    athlete.athleteId,
    payload.eventId,
  )
  return {
    ok: true,
    counterName: counter.counterName,
    mode: reg ? 'ready' : 'need_bib',
  }
}

export type QueueResult =
  | { ok: false; error: string }
  | { ok: true; displayNumber: number; statusToken: string; counterName: string }

export async function requestQueue(
  _prev: QueueResult | null,
  formData: FormData,
): Promise<QueueResult> {
  const token = formData.get('token') as string
  const liffIdToken = formData.get('liffIdToken') as string

  const payload = await verifyQueueToken(token)
  if (!payload) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' }
  const counter = await getCounter(payload.counterId)
  if (!counter || counter.eventId !== payload.eventId) {
    return { ok: false, error: 'ไม่พบจุดบริการ' }
  }
  if (!counter.isOpen) return { ok: false, error: 'ขณะนี้ปิดรับคิว' }

  let lineUserId: string
  try {
    lineUserId = await verifyLiffIdToken(liffIdToken)
  } catch {
    return { ok: false, error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาเปิดผ่าน LINE ใหม่' }
  }

  // เตรียม athlete/registration ตามเคส
  let athleteId: string | null = null
  let registrationId: string | null = null
  let bibNumber: string | null = null

  const athlete = await getAthleteByLineUserId(lineUserId)
  if (athlete) {
    athleteId = athlete.athleteId
    const reg = await getRegistrationByAthleteAndEvent(
      athlete.athleteId,
      payload.eventId,
    )
    if (reg) {
      // เคส 1 — ลงทะเบียนแล้ว
      registrationId = reg.registrationId
      bibNumber = reg.bibNumber
    } else {
      // เคส 2 — สมาชิกแต่ยังไม่ลงทะเบียน → ต้องมี bib
      const bib = ((formData.get('bib') as string) ?? '').trim().toUpperCase()
      if (!isValidBib(bib)) return { ok: false, error: 'กรุณากรอก BIB ให้ถูกต้อง' }
      await createRegistrationForExistingAthlete({
        athleteId: athlete.athleteId,
        eventId: payload.eventId,
        bibNumber: bib,
      })
      bibNumber = bib
    }
  } else {
    // เคส 3 — ยังไม่เป็นสมาชิก → กรอกข้อมูล + bib
    const bib = ((formData.get('bib') as string) ?? '').trim().toUpperCase()
    const firstName = ((formData.get('firstName') as string) ?? '').trim()
    const lastName = ((formData.get('lastName') as string) ?? '').trim()
    const dateOfBirth = (formData.get('dateOfBirth') as string) ?? ''
    const rawGender = (formData.get('gender') as string) ?? ''
    const gender = (rawGender === 'lgbtq' ? 'other' : rawGender) as
      | 'male'
      | 'female'
      | 'other'
    if (!isValidBib(bib) || !firstName || !lastName || !dateOfBirth || !gender) {
      return { ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return { ok: false, error: 'วันเกิดไม่ถูกต้อง' }
    }
    const created = await createAthleteAndRegistration({
      lineUserId,
      eventId: payload.eventId,
      bibNumber: bib,
      firstName,
      lastName,
      dateOfBirth,
      gender,
    })
    await insertAthleteConsent(created.athleteId)
    athleteId = created.athleteId
    bibNumber = bib
  }

  // ออกเลขคิว (dedup ภายใน)
  const { entry } = await enqueue({
    counterId: counter.counterId,
    athleteId,
    registrationId,
    bibNumber,
    lineUserId,
  })

  // ส่ง flex แจ้งเลขคิว + ลิงก์สถานะ
  const statusUrl = `${APP_BASE}/q/${entry.statusToken}`
  try {
    await pushMessage(lineUserId, [
      queueTicketMessage({
        counterName: counter.counterName,
        displayNumber: entry.displayNumber,
        statusUrl,
      }),
    ])
  } catch {
    console.error('[requestQueue] pushMessage failed for', lineUserId)
  }

  return {
    ok: true,
    displayNumber: entry.displayNumber,
    statusToken: entry.statusToken,
    counterName: counter.counterName,
  }
}
