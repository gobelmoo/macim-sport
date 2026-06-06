'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import {
  deleteDraftEvent,
  getEvent,
  updateEvent,
  updateEventStatus,
} from '@/db/queries/events'
import {
  createStation,
  deleteStation,
  toggleStationStatus,
  updateStation,
} from '@/db/queries/stations'
import {
  addGalleryImage,
  deleteGalleryImage,
  updateGalleryCaption,
  reorderGalleryImages,
} from '@/db/queries/event_gallery_images'
import type { eventStatusEnum } from '@/db/schema/events'

export type ActionState = {
  success?: boolean
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
  eventLogoUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().max(300).optional(),
  longDescription: z.string().optional(),
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

function revalidateEventData(eventId: string) {
  revalidatePath(`/dashboard/events/${eventId}`, 'layout')
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
    eventLogoUrl: formData.get('eventLogoUrl') || undefined,
    description: formData.get('description') || undefined,
    longDescription: formData.get('longDescription') || undefined,
  }

  const parsed = updateEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateEvent(eventId, parsed.data)
  revalidateEventData(eventId)
  return {}
}

export async function updateEventStatusAction(
  eventId: string,
  newStatus: (typeof eventStatusEnum.enumValues)[number],
): Promise<void> {
  await assertOwnerOrManager()
  await updateEventStatus(eventId, newStatus)
  revalidateEventData(eventId)
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
  revalidateEventData(eventId)
  return { success: true }
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
  revalidateEventData(eventId)
  return { success: true }
}

export async function toggleStationStatusAction(
  stationId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  await toggleStationStatus(stationId)
  revalidateEventData(eventId)
}

export async function deleteStationAction(
  stationId: string,
  eventId: string,
): Promise<void> {
  const [, event] = await Promise.all([assertOwnerOrManager(), getEvent(eventId)])
  if (!event || event.status === 'active') throw new Error('ลบ station ไม่ได้เมื่อ event กำลังจัดงาน')
  await deleteStation(stationId)
  revalidateEventData(eventId)
}

export async function deleteEventAction(eventId: string): Promise<void> {
  await assertOwnerOrManager()
  const deleted = await deleteDraftEvent(eventId)
  if (!deleted) throw new Error('ลบไม่ได้ — event ไม่ใช่ draft หรือไม่พบ')
  revalidatePath('/dashboard/events')
  redirect('/dashboard/events')
}

export async function addGalleryImageAction(
  eventId: string,
  imageUrl: string,
  caption: string | null | undefined,
): Promise<{ imageId: string } | { error: string }> {
  await assertOwnerOrManager()
  try {
    const { imageId } = await addGalleryImage({
      eventId,
      imageUrl,
      caption: caption ?? undefined,
    })
    revalidatePath(`/dashboard/events/${eventId}/edit`)
    return { imageId }
  } catch {
    return { error: 'เพิ่มรูปไม่สำเร็จ' }
  }
}

export async function deleteGalleryImageAction(
  imageId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  await deleteGalleryImage(imageId)
  revalidatePath(`/dashboard/events/${eventId}/edit`)
}

export async function updateGalleryCaptionAction(
  imageId: string,
  eventId: string,
  caption: string | null,
): Promise<void> {
  await assertOwnerOrManager()
  await updateGalleryCaption(imageId, caption)
  revalidatePath(`/dashboard/events/${eventId}/edit`)
}

export async function reorderGalleryAction(
  eventId: string,
  orderedImageIds: string[],
): Promise<void> {
  await assertOwnerOrManager()
  await reorderGalleryImages(orderedImageIds)
  revalidatePath(`/dashboard/events/${eventId}/edit`)
}
