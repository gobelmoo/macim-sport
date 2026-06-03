'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { updateEvent, updateEventStatus } from '@/db/queries/events'
import {
  createStation,
  updateStation,
  hideStation,
} from '@/db/queries/stations'
import type { eventStatusEnum } from '@/db/schema/events'

export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

const updateEventSchema = z.object({
  sponsorId: z.string().min(1, 'กรุณาเลือก Sponsor').optional(),
  eventName: z.string().min(1, 'กรุณาระบุชื่องาน').optional(),
  eventLocation: z.string().min(1, 'กรุณาระบุสถานที่').optional(),
  eventCity: z.string().min(1, 'กรุณาระบุเมือง').optional(),
  eventType: z.enum(['run', 'triathlon', 'other']).optional(),
  organizerName: z.string().min(1, 'กรุณาระบุชื่อผู้จัด').optional(),
  startDate: z.string().min(1, 'กรุณาระบุวันที่เริ่ม').optional(),
  endDate: z.string().min(1, 'กรุณาระบุวันที่สิ้นสุด').optional(),
})

const stationSchema = z.object({
  stationType: z.enum(['air_recovery', 'ice_bath', 'other']),
  stationName: z.string().min(1, 'กรุณาระบุชื่อ Station'),
  stampOnAddFriend: z.boolean(),
})

async function assertOwnerOrManager() {
  const session = await auth()
  const role = session?.user?.role
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    throw new Error('ไม่มีสิทธิ์ดำเนินการนี้')
  }
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
  revalidatePath(`/dashboard/events/${eventId}`)
  return {}
}

export async function updateEventStatusAction(
  eventId: string,
  newStatus: (typeof eventStatusEnum.enumValues)[number],
): Promise<void> {
  await assertOwnerOrManager()
  await updateEventStatus(eventId, newStatus)
  revalidatePath(`/dashboard/events/${eventId}`)
}

export async function createStationAction(
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    stationType: formData.get('stationType'),
    stationName: formData.get('stationName'),
    stampOnAddFriend: formData.get('stampOnAddFriend') === 'on',
  }

  const parsed = stationSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await createStation({ eventId, ...parsed.data })
  revalidatePath(`/dashboard/events/${eventId}/stations`)
  redirect(`/dashboard/events/${eventId}/stations`)
}

export async function updateStationAction(
  stationId: string,
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    stationType: formData.get('stationType'),
    stationName: formData.get('stationName'),
    stampOnAddFriend: formData.get('stampOnAddFriend') === 'on',
  }

  const parsed = stationSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateStation(stationId, parsed.data)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
  return {}
}

export async function hideStationAction(
  stationId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  await hideStation(stationId)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
}
