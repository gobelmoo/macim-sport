import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { events } from '@/db/schema/events'
import { sponsors } from '@/db/schema/sponsors'
import { athleteEventRegistrations } from '@/db/schema/athlete_event_registrations'
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
  eventLogoUrl: string | null
  description: string | null
  longDescription: string | null
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
  eventLogoUrl?: string | null
  description?: string | null
  longDescription?: string | null
}

export type UpdateEventData = Partial<CreateEventData>

export type EventRowWithCount = EventRow & { registrationCount: number }

export type EventDetailRow = {
  eventId: string
  eventName: string
  eventLocation: string
  eventCity: string
  eventType: (typeof eventTypeEnum.enumValues)[number]
  organizerName: string
  startDate: string
  endDate: string
  status: (typeof eventStatusEnum.enumValues)[number]
  eventLogoUrl: string | null
  description: string | null
  longDescription: string | null
}

const EVENT_SELECT_FIELDS = {
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
  eventLogoUrl: events.eventLogoUrl,
  description: events.description,
  longDescription: events.longDescription,
}

export async function listEvents(sponsorId?: string): Promise<EventRow[]> {
  return db
    .select(EVENT_SELECT_FIELDS)
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .where(sponsorId ? eq(events.sponsorId, sponsorId) : undefined)
    .orderBy(desc(events.startDate))
}

export async function listEventsWithCounts(sponsorId?: string): Promise<EventRowWithCount[]> {
  const rows = await db
    .select({
      ...EVENT_SELECT_FIELDS,
      registrationCount: count(athleteEventRegistrations.registrationId),
    })
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .leftJoin(
      athleteEventRegistrations,
      eq(athleteEventRegistrations.eventId, events.eventId),
    )
    .where(sponsorId ? eq(events.sponsorId, sponsorId) : undefined)
    .groupBy(
      events.eventId,
      events.sponsorId,
      events.eventName,
      events.eventLocation,
      events.eventCity,
      events.eventType,
      events.organizerName,
      events.startDate,
      events.endDate,
      events.isPublic,
      events.hasParticipantImport,
      events.status,
      events.createdAt,
      sponsors.sponsorName,
      events.eventLogoUrl,
      events.description,
      events.longDescription,
    )
    .orderBy(desc(events.startDate))

  return rows.map((r) => ({ ...r, registrationCount: Number(r.registrationCount) }))
}

export async function getEvent(eventId: string): Promise<EventRow | undefined> {
  const [row] = await db
    .select(EVENT_SELECT_FIELDS)
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .where(eq(events.eventId, eventId))
    .limit(1)

  return row
}

export async function getEventDetail(eventId: string): Promise<EventDetailRow | undefined> {
  const [row] = await db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      eventLocation: events.eventLocation,
      eventCity: events.eventCity,
      eventType: events.eventType,
      organizerName: events.organizerName,
      startDate: events.startDate,
      endDate: events.endDate,
      status: events.status,
      eventLogoUrl: events.eventLogoUrl,
      description: events.description,
      longDescription: events.longDescription,
    })
    .from(events)
    .where(eq(events.eventId, eventId))
    .limit(1)

  return row
}

export async function createEvent(data: CreateEventData): Promise<{ eventId: string }> {
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

export async function deleteDraftEvent(eventId: string): Promise<boolean> {
  const [row] = await db
    .delete(events)
    .where(and(eq(events.eventId, eventId), eq(events.status, 'draft')))
    .returning({ eventId: events.eventId })

  return !!row
}
