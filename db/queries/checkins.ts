import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { athletes } from '@/db/schema/athletes'
import { athleteEventRegistrations } from '@/db/schema/athlete_event_registrations'
import { checkins } from '@/db/schema/checkins'
import { events } from '@/db/schema/events'
import { stamps } from '@/db/schema/stamps'
import { stations } from '@/db/schema/stations'
import type { stampSourceEnum } from '@/db/schema/stamps'
import type { eventStatusEnum } from '@/db/schema/events'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type BibLookupResult = {
  registrationId: string
  athleteId: string
  bibNumber: string
  firstName: string
  lastName: string
  profileImageUrl: string | null
  lineUserId: string | null
}

export type ActiveEventRow = {
  eventId: string
  eventName: string
  eventLocation: string
  eventCity: string
  startDate: string
  endDate: string
  status: (typeof eventStatusEnum.enumValues)[number]
}

export type StationRow = {
  stationId: string
  eventId: string
  stationName: string
  status: 'active' | 'inactive'
}

export type EventWithStations = ActiveEventRow & {
  stations: StationRow[]
}

export type CreateCheckinData = {
  athleteId: string
  stationId: string
  eventId: string
  bibNumber: string
  isNewAthlete: boolean
  isDuplicate: boolean
}

export type CreateStampData = {
  athleteId: string
  eventId: string
  stationId: string
  sponsorId: string
  stampSource: (typeof stampSourceEnum.enumValues)[number]
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Look up a registration by BIB + event, joined with the athlete.
 * profileImageUrl lives on registrations, not on athletes.
 */
export async function lookupByBib(
  bibNumber: string,
  eventId: string,
): Promise<BibLookupResult | null> {
  const [row] = await db
    .select({
      registrationId: athleteEventRegistrations.registrationId,
      athleteId: athletes.athleteId,
      bibNumber: athleteEventRegistrations.bibNumber,
      firstName: athletes.firstName,
      lastName: athletes.lastName,
      profileImageUrl: athleteEventRegistrations.profileImageUrl,
      lineUserId: athletes.lineUserId,
    })
    .from(athleteEventRegistrations)
    .innerJoin(
      athletes,
      eq(athleteEventRegistrations.athleteId, athletes.athleteId),
    )
    .where(
      and(
        eq(athleteEventRegistrations.bibNumber, bibNumber),
        eq(athleteEventRegistrations.eventId, eventId),
      ),
    )
    .limit(1)

  return row ?? null
}

/**
 * Returns true if the athlete already has at least one non-duplicate checkin
 * for this event (stamp_scope = per_event, stamp_rule = first_only).
 */
export async function hasCheckinForEvent(
  athleteId: string,
  eventId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ checkinId: checkins.checkinId })
    .from(checkins)
    .where(
      and(
        eq(checkins.athleteId, athleteId),
        eq(checkins.eventId, eventId),
        eq(checkins.isDuplicate, false),
      ),
    )
    .limit(1)

  return row !== undefined
}

/**
 * Insert a new checkin record and return its id.
 */
export async function createCheckin(
  data: CreateCheckinData,
): Promise<{ checkinId: string }> {
  const [row] = await db
    .insert(checkins)
    .values(data)
    .returning({ checkinId: checkins.checkinId })

  return row
}

/**
 * Insert a new stamp record and return its id.
 */
export async function createStamp(
  data: CreateStampData,
): Promise<{ stampId: string }> {
  const [row] = await db
    .insert(stamps)
    .values(data)
    .returning({ stampId: stamps.stampId })

  return row
}

/**
 * Return an event together with its active stations.
 */
export async function getEventWithStations(
  eventId: string,
): Promise<EventWithStations | null> {
  const [eventRows, stationRows] = await Promise.all([
    db
      .select({
        eventId: events.eventId,
        eventName: events.eventName,
        eventLocation: events.eventLocation,
        eventCity: events.eventCity,
        startDate: events.startDate,
        endDate: events.endDate,
        status: events.status,
      })
      .from(events)
      .where(eq(events.eventId, eventId))
      .limit(1),

    db
      .select({
        stationId: stations.stationId,
        eventId: stations.eventId,
        stationName: stations.stationName,
        status: stations.status,
      })
      .from(stations)
      .where(and(eq(stations.eventId, eventId), eq(stations.status, 'active')))
      .orderBy(stations.createdAt),
  ])

  const eventRow = eventRows[0]
  if (!eventRow) return null
  return { ...eventRow, stations: stationRows }
}

/**
 * Return all active events ordered by startDate descending.
 */
export async function getActiveEvents(): Promise<ActiveEventRow[]> {
  return db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      eventLocation: events.eventLocation,
      eventCity: events.eventCity,
      startDate: events.startDate,
      endDate: events.endDate,
      status: events.status,
    })
    .from(events)
    .where(eq(events.status, 'active'))
    .orderBy(desc(events.startDate))
}

/**
 * Return the sponsorId for a station (via events join).
 * Used when creating stamps — sponsorId must come from the event.
 */
export async function getStationSponsorId(
  stationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ sponsorId: events.sponsorId })
    .from(stations)
    .innerJoin(events, eq(stations.eventId, events.eventId))
    .where(eq(stations.stationId, stationId))
    .limit(1)

  return row?.sponsorId ?? null
}
