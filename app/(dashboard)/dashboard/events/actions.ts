'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import {
  createEvent,
  updateEvent,
  updateEventStatus,
} from '@/db/queries/events'
import type { eventStatusEnum } from '@/db/schema/events'

export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

const createEventSchema = z.object({
  sponsorId: z.string().min(1, 'กรุณาเลือก Sponsor'),
  eventName: z.string().min(1, 'กรุณาระบุชื่องาน'),
  eventLocation: z.string().min(1, 'กรุณาระบุสถานที่'),
  eventCity: z.string().min(1, 'กรุณาระบุเมือง'),
  eventType: z.enum(['run', 'triathlon', 'other']),
  organizerName: z.string().min(1, 'กรุณาระบุชื่อผู้จัด'),
  startDate: z.string().min(1, 'กรุณาระบุวันที่เริ่ม'),
  endDate: z.string().min(1, 'กรุณาระบุวันที่สิ้นสุด'),
})

const updateEventSchema = createEventSchema.partial().extend({
  sponsorId: z.string().optional(),
})

async function assertOwnerOrManager() {
  const session = await auth()
  const role = session?.user?.role
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    throw new Error('ไม่มีสิทธิ์ดำเนินการนี้')
  }
  return session!
}

export async function createEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    sponsorId: formData.get('sponsorId'),
    eventName: formData.get('eventName'),
    eventLocation: formData.get('eventLocation'),
    eventCity: formData.get('eventCity'),
    eventType: formData.get('eventType'),
    organizerName: formData.get('organizerName'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
  }

  const parsed = createEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { eventId } = await createEvent(parsed.data)
  redirect(`/dashboard/events/${eventId}`)
}

export async function updateEventAction(
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    sponsorId: formData.get('sponsorId') ?? undefined,
    eventName: formData.get('eventName') ?? undefined,
    eventLocation: formData.get('eventLocation') ?? undefined,
    eventCity: formData.get('eventCity') ?? undefined,
    eventType: formData.get('eventType') ?? undefined,
    organizerName: formData.get('organizerName') ?? undefined,
    startDate: formData.get('startDate') ?? undefined,
    endDate: formData.get('endDate') ?? undefined,
  }

  const parsed = updateEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateEvent(eventId, parsed.data)
  redirect(`/dashboard/events/${eventId}`)
}

export async function updateEventStatusAction(
  eventId: string,
  newStatus: (typeof eventStatusEnum.enumValues)[number],
): Promise<ActionState> {
  await assertOwnerOrManager()
  await updateEventStatus(eventId, newStatus)
  return {}
}
