'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { verifyQueueToken } from '@/lib/queue-token'
import {
  enqueue,
  nextQueue,
  requeueEntry,
  resetCounter,
  setCounterOpen,
  skipEntry,
} from '@/db/queries/queue'
import { getRegistrationByBibAndEvent } from '@/db/queries/line'
import { isValidBib } from '@/lib/line-state'

type Result = { ok: true } | { ok: false; message: string }

const DENY: Result = { ok: false, message: 'ไม่มีสิทธิ์' }

/**
 * Auth context ของ board action ตีความ "token (staff, no-login) หรือ session"
 * ที่เดียว แล้วคืน revalidate() ที่ผูกกับ path ของโหมดนั้น — คืน null ถ้าไม่มีสิทธิ์.
 */
async function resolveBoardCtx(
  eventId: string,
  counterId: string,
  token?: string,
): Promise<{ revalidate: () => void } | null> {
  if (token) {
    const p = await verifyQueueToken(token, 'operate')
    if (!p || p.counterId !== counterId || p.eventId !== eventId) return null
    return { revalidate: () => revalidatePath(`/station-queue/${token}`) }
  }
  const session = await auth()
  if (!session?.user || !canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) {
    return null
  }
  return {
    revalidate: () =>
      revalidatePath(`/dashboard/events/${eventId}/queue/${counterId}/board`),
  }
}

export async function toggleOpenAction(
  eventId: string,
  counterId: string,
  isOpen: boolean,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  await setCounterOpen(counterId, isOpen)
  ctx.revalidate()
  return { ok: true }
}

export async function resetCounterAction(
  eventId: string,
  counterId: string,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  await resetCounter(counterId)
  ctx.revalidate()
  return { ok: true }
}

export async function nextQueueAction(
  eventId: string,
  counterId: string,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  await nextQueue(counterId)
  ctx.revalidate()
  return { ok: true }
}

export async function skipEntryAction(
  eventId: string,
  counterId: string,
  entryId: string,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  await skipEntry(entryId)
  ctx.revalidate()
  return { ok: true }
}

export async function requeueEntryAction(
  eventId: string,
  counterId: string,
  entryId: string,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  await requeueEntry(entryId)
  ctx.revalidate()
  return { ok: true }
}

/** เพิ่มคิวแทนนักกีฬาด้วย BIB (ต้องลงทะเบียน event แล้ว) */
export async function addByBibAction(
  eventId: string,
  counterId: string,
  rawBib: string,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  const bib = rawBib.trim().toUpperCase()
  if (!isValidBib(bib)) return { ok: false, message: 'BIB ไม่ถูกต้อง' }
  const reg = await getRegistrationByBibAndEvent(bib, eventId)
  if (!reg) return { ok: false, message: 'ไม่พบ BIB นี้ในงาน' }
  await enqueue({
    counterId,
    athleteId: reg.athleteId,
    registrationId: reg.registrationId,
    bibNumber: reg.bibNumber,
    lineUserId: reg.athleteLineUserId,
  })
  ctx.revalidate()
  return { ok: true }
}

/** เพิ่มคิวให้คนที่ไม่ใช่ member / ไม่ได้ลงทะเบียน */
export async function addNonMemberAction(
  eventId: string,
  counterId: string,
  rawLabel: string,
  token?: string,
): Promise<Result> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  const label = rawLabel.trim()
  if (!label) return { ok: false, message: 'กรุณาระบุชื่อ/ป้ายกำกับ' }
  await enqueue({
    counterId,
    isNonMember: true,
    displayLabel: label,
  })
  ctx.revalidate()
  return { ok: true }
}
