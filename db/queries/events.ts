import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { events } from '@/db/schema/events'
import { sponsors } from '@/db/schema/sponsors'
import type { eventStatusEnum, eventTypeEnum } from '@/db/schema/events'

export type EventRow = {
  eventId: string
  sponsorId: string
  eventName: string
  eventLocation: string
  eventCity: string
  eventType: (typeof eventTypeEnum.enumValues)[number]
  organizerName: string
  startDate: string
  endDate: string
  isPublic: boolean
  hasParticipantImport: boolean
  status: (typeof eventStatusEnum.enumValues)[number]
  createdAt: Date
  sponsorName: string
}

export type CreateEventData = {
  sponsorId: string
  eventName: string
  eventLocation: string
  eventCity: string
  eventType: (typeof eventTypeEnum.enumValues)[number]
  organizerName: string
  startDate: string
  endDate: string
}

export type UpdateEventData = Partial<CreateEventData>

export async function listEvents(sponsorId?: string): Promise<EventRow[]> {
  const rows = await db
    .select({
      eventId: events.eventId,
      sponsorId: events.sponsorId,
      eventName: events.eventName,
      eventLocation: events.eventLocation,
      eventCity: events.eventCity,
      eventType: events.eventType,
      organizerName: events.organizerName,
      startDate: events.startDate,
      endDate: events.endDate,
      isPublic: events.isPublic,
      hasParticipantImport: events.hasParticipantImport,
      status: events.status,
      createdAt: events.createdAt,
      sponsorName: sponsors.sponsorName,
    })
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .where(sponsorId ? eq(events.sponsorId, sponsorId) : undefined)
    .orderBy(desc(events.startDate))

  return rows
}

export async function getEvent(eventId: string): Promise<EventRow | undefined> {
  const [row] = await db
    .select({
      eventId: events.eventId,
      sponsorId: events.sponsorId,
      eventName: events.eventName,
      eventLocation: events.eventLocation,
      eventCity: events.eventCity,
      eventType: events.eventType,
      organizerName: events.organizerName,
      startDate: events.startDate,
      endDate: events.endDate,
      isPublic: events.isPublic,
      hasParticipantImport: events.hasParticipantImport,
      status: events.status,
      createdAt: events.createdAt,
      sponsorName: sponsors.sponsorName,
    })
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .where(eq(events.eventId, eventId))
    .limit(1)

  return row
}

export async function createEvent(
  data: CreateEventData,
): Promise<{ eventId: string }> {
  const [row] = await db
    .insert(events)
    .values(data)
    .returning({ eventId: events.eventId })

  return row
}

export async function updateEvent(
  eventId: string,
  data: UpdateEventData,
): Promise<{ eventId: string }> {
  const [row] = await db
    .update(events)
    .set(data)
    .where(eq(events.eventId, eventId))
    .returning({ eventId: events.eventId })

  return row
}

export async function updateEventStatus(
  eventId: string,
  status: (typeof eventStatusEnum.enumValues)[number],
): Promise<{ eventId: string }> {
  const [row] = await db
    .update(events)
    .set({ status })
    .where(eq(events.eventId, eventId))
    .returning({ eventId: events.eventId })

  return row
}
