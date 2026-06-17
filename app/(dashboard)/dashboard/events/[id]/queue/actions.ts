'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { createCounter, deleteCounter } from '@/db/queries/queue'

const createSchema = z.object({
  counterName: z.string().trim().min(1, 'กรุณากรอกชื่อจุดบริการ').max(60),
})

export type CounterFormState = { error?: string } | null

export async function createCounterAction(
  eventId: string,
  _prev: CounterFormState,
  formData: FormData,
): Promise<CounterFormState> {
  const session = await auth()
  if (!session?.user) return { error: 'ไม่ได้รับอนุญาต' }
  if (!canAccess(PERMISSIONS.QUEUE_MANAGE, session.user)) {
    return { error: 'ไม่มีสิทธิ์จัดการคิว' }
  }
  const parsed = createSchema.safeParse({
    counterName: formData.get('counterName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  await createCounter({ eventId, counterName: parsed.data.counterName })
  revalidatePath(`/dashboard/events/${eventId}/queue`)
  return null
}

export async function deleteCounterAction(
  eventId: string,
  counterId: string,
): Promise<{ message?: string } | void> {
  const session = await auth()
  if (!session?.user) return { message: 'ไม่ได้รับอนุญาต' }
  if (!canAccess(PERMISSIONS.QUEUE_MANAGE, session.user)) {
    return { message: 'ไม่มีสิทธิ์จัดการคิว' }
  }
  await deleteCounter(counterId)
  revalidatePath(`/dashboard/events/${eventId}/queue`)
}
