'use server'

import { revalidatePath } from 'next/cache'
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

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

const DENY = { ok: false, message: 'ไม่มีสิทธิ์' } as const

/** ตีความ operate token → counterId/eventId + revalidate ของหน้านี้ */
async function resolve(token: string) {
  const p = await verifyQueueToken(token, 'operate')
  if (!p) return null
  return {
    counterId: p.counterId,
    eventId: p.eventId,
    revalidate: () => revalidatePath(`/station-queue/${token}`),
  }
}

export async function toggleOpenAction(
  token: string,
  isOpen: boolean,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await setCounterOpen(ctx.counterId, isOpen)
  ctx.revalidate()
  return { ok: true }
}

export async function resetCounterAction(token: string): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await resetCounter(ctx.counterId)
  ctx.revalidate()
  return { ok: true }
}

export async function nextQueueAction(token: string): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await nextQueue(ctx.counterId)
  ctx.revalidate()
  return { ok: true }
}

export async function skipEntryAction(
  token: string,
  entryId: string,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await skipEntry(entryId)
  ctx.revalidate()
  return { ok: true }
}

export async function requeueEntryAction(
  token: string,
  entryId: string,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await requeueEntry(entryId)
  ctx.revalidate()
  return { ok: true }
}

/** เพิ่มคิว: BIB ที่ลงทะเบียน → ผูกนักกีฬา; มิฉะนั้น → non-member ป้าย = input */
export async function addQueueAction(
  token: string,
  rawInput: string,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  const input = rawInput.trim()
  if (!input) return { ok: false, message: 'กรุณากรอก BIB หรือ ชื่อ' }

  const bib = input.toUpperCase()
  if (isValidBib(bib)) {
    const reg = await getRegistrationByBibAndEvent(bib, ctx.eventId)
    if (reg) {
      const { entry, created } = await enqueue({
        counterId: ctx.counterId,
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

  const { entry, created } = await enqueue({
    counterId: ctx.counterId,
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
