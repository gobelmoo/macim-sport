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

const DENY = { ok: false, message: 'ไม่มีสิทธิ์' } as const

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

type AddResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

/**
 * เพิ่มคิวแทนนักกีฬาด้วย input เดียว (BIB หรือ ชื่อ).
 * ถ้า input เป็นรูปแบบ BIB และเจอ registration ในงาน → ผูกนักกีฬาคนนั้น
 * มิฉะนั้น → เพิ่มเป็น non-member โดยใช้ input เป็นป้ายกำกับ.
 */
export async function addQueueAction(
  eventId: string,
  counterId: string,
  rawInput: string,
  token?: string,
): Promise<AddResult> {
  const ctx = await resolveBoardCtx(eventId, counterId, token)
  if (!ctx) return DENY
  const input = rawInput.trim()
  if (!input) return { ok: false, message: 'กรุณากรอก BIB หรือ ชื่อ' }

  // รูปแบบเป็น BIB → ลอง lookup registration ในงาน
  const bib = input.toUpperCase()
  if (isValidBib(bib)) {
    const reg = await getRegistrationByBibAndEvent(bib, eventId)
    if (reg) {
      const { entry, created } = await enqueue({
        counterId,
        athleteId: reg.athleteId,
        registrationId: reg.registrationId,
        bibNumber: reg.bibNumber,
        lineUserId: reg.athleteLineUserId,
      })
      ctx.revalidate()
      const name = [reg.athleteFirstName, reg.athleteLastName]
        .filter(Boolean)
        .join(' ')
      const who = `${name || 'นักกีฬา'} (BIB ${reg.bibNumber})`
      return {
        ok: true,
        message: created
          ? `เพิ่มคิว #${entry.displayNumber} — ${who}`
          : `${who} อยู่ในคิวแล้ว (หมายเลข #${entry.displayNumber})`,
      }
    }
  }

  // ไม่ใช่ bib ที่ลงทะเบียน → non-member (ใช้ input เป็นป้ายกำกับ)
  const { entry, created } = await enqueue({
    counterId,
    isNonMember: true,
    displayLabel: input,
  })
  ctx.revalidate()
  return {
    ok: true,
    message: created
      ? `เพิ่มคิว #${entry.displayNumber} — ${input} (ไม่ใช่สมาชิก)`
      : `${input} อยู่ในคิวแล้ว (หมายเลข #${entry.displayNumber})`,
  }
}
