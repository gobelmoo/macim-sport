'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
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

async function authorize(): Promise<boolean> {
  const session = await auth()
  return !!session?.user && canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)
}

function revalidateBoard(eventId: string, counterId: string) {
  revalidatePath(`/dashboard/events/${eventId}/queue/${counterId}/board`)
}

export async function toggleOpenAction(
  eventId: string,
  counterId: string,
  isOpen: boolean,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await setCounterOpen(counterId, isOpen)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function resetCounterAction(
  eventId: string,
  counterId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await resetCounter(counterId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function nextQueueAction(
  eventId: string,
  counterId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await nextQueue(counterId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function skipEntryAction(
  eventId: string,
  counterId: string,
  entryId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await skipEntry(entryId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function requeueEntryAction(
  eventId: string,
  counterId: string,
  entryId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await requeueEntry(entryId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

/** เพิ่มคิวแทนนักกีฬาด้วย BIB (ต้องลงทะเบียน event แล้ว) */
export async function addByBibAction(
  eventId: string,
  counterId: string,
  rawBib: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
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
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

/** เพิ่มคิวให้คนที่ไม่ใช่ member / ไม่ได้ลงทะเบียน */
export async function addNonMemberAction(
  eventId: string,
  counterId: string,
  rawLabel: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  const label = rawLabel.trim()
  if (!label) return { ok: false, message: 'กรุณาระบุชื่อ/ป้ายกำกับ' }
  await enqueue({
    counterId,
    isNonMember: true,
    displayLabel: label,
  })
  revalidateBoard(eventId, counterId)
  return { ok: true }
}
