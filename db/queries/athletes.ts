import { and, count, eq, inArray } from 'drizzle-orm'
import { stamps } from '@/db/schema/stamps'
import { db } from '@/db'
import { athleteEventRegistrations } from '@/db/schema/athlete_event_registrations'
import { athletes } from '@/db/schema/athletes'
import { checkins } from '@/db/schema/checkins'
import { events } from '@/db/schema/events'
import { stations } from '@/db/schema/stations'
import type { genderEnum } from '@/db/schema/athletes'

export interface AthleteRow {
  athleteId: string
  firstName: string
  lastName: string
  gender: (typeof genderEnum.enumValues)[number]
  dateOfBirth: string
  lineUserId: string | null
  createdAt: Date
}

export async function listAthletes(opts?: {
  sponsorId?: string
}): Promise<AthleteRow[]> {
  const sponsorId = opts?.sponsorId

  if (sponsorId) {
    // Find all events belonging to this sponsor
    const sponsorEvents = await db
      .select({ eventId: events.eventId })
      .from(events)
      .where(eq(events.sponsorId, sponsorId))

    const eventIds = sponsorEvents.map((e) => e.eventId)

    if (eventIds.length === 0) return []

    // Find all athletes registered for those events (athleteId may be null)
    const registrations = await db
      .select({ athleteId: athleteEventRegistrations.athleteId })
      .from(athleteEventRegistrations)
      .where(inArray(athleteEventRegistrations.eventId, eventIds))

    const athleteIds = [
      ...new Set(
        registrations
          .map((r) => r.athleteId)
          .filter((id): id is string => id !== null),
      ),
    ]

    if (athleteIds.length === 0) return []

    const rows = await db
      .select({
        athleteId: athletes.athleteId,
        firstName: athletes.firstName,
        lastName: athletes.lastName,
        gender: athletes.gender,
        dateOfBirth: athletes.dateOfBirth,
        lineUserId: athletes.lineUserId,
        createdAt: athletes.createdAt,
      })
      .from(athletes)
      .where(inArray(athletes.athleteId, athleteIds))
      .orderBy(athletes.lastName, athletes.firstName)

    return rows
  }

  // No sponsorId — return all athletes
  const rows = await db
    .select({
      athleteId: athletes.athleteId,
      firstName: athletes.firstName,
      lastName: athletes.lastName,
      gender: athletes.gender,
      dateOfBirth: athletes.dateOfBirth,
      lineUserId: athletes.lineUserId,
      createdAt: athletes.createdAt,
    })
    .from(athletes)
    .orderBy(athletes.lastName, athletes.firstName)

  return rows
}

export async function getAthleteCheckinCount(
  athleteId: string,
): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(checkins)
    .where(eq(checkins.athleteId, athleteId))

  return Number(result?.value ?? 0)
}

export interface AthleteWithCheckinCount extends AthleteRow {
  checkinCount: number
}

/**
 * Lists athletes with their total check-in count in a single efficient query
 * using a left join + aggregation rather than N+1 calls to getAthleteCheckinCount.
 */
export async function listAthletesWithCheckinCounts(opts?: {
  sponsorId?: string
}): Promise<AthleteWithCheckinCount[]> {
  const sponsorId = opts?.sponsorId

  if (sponsorId) {
    const sponsorEvents = await db
      .select({ eventId: events.eventId })
      .from(events)
      .where(eq(events.sponsorId, sponsorId))

    const eventIds = sponsorEvents.map((e) => e.eventId)
    if (eventIds.length === 0) return []

    const registrations = await db
      .select({ athleteId: athleteEventRegistrations.athleteId })
      .from(athleteEventRegistrations)
      .where(inArray(athleteEventRegistrations.eventId, eventIds))

    const athleteIds = [
      ...new Set(
        registrations
          .map((r) => r.athleteId)
          .filter((id): id is string => id !== null),
      ),
    ]

    if (athleteIds.length === 0) return []

    const rows = await db
      .select({
        athleteId: athletes.athleteId,
        firstName: athletes.firstName,
        lastName: athletes.lastName,
        gender: athletes.gender,
        dateOfBirth: athletes.dateOfBirth,
        lineUserId: athletes.lineUserId,
        createdAt: athletes.createdAt,
        checkinCount: count(checkins.checkinId),
      })
      .from(athletes)
      .leftJoin(checkins, eq(checkins.athleteId, athletes.athleteId))
      .where(inArray(athletes.athleteId, athleteIds))
      .groupBy(
        athletes.athleteId,
        athletes.firstName,
        athletes.lastName,
        athletes.gender,
        athletes.dateOfBirth,
        athletes.lineUserId,
        athletes.createdAt,
      )
      .orderBy(athletes.lastName, athletes.firstName)

    return rows.map((r) => ({ ...r, checkinCount: Number(r.checkinCount) }))
  }

  const rows = await db
    .select({
      athleteId: athletes.athleteId,
      firstName: athletes.firstName,
      lastName: athletes.lastName,
      gender: athletes.gender,
      dateOfBirth: athletes.dateOfBirth,
      lineUserId: athletes.lineUserId,
      createdAt: athletes.createdAt,
      checkinCount: count(checkins.checkinId),
    })
    .from(athletes)
    .leftJoin(checkins, eq(checkins.athleteId, athletes.athleteId))
    .groupBy(
      athletes.athleteId,
      athletes.firstName,
      athletes.lastName,
      athletes.gender,
      athletes.dateOfBirth,
      athletes.lineUserId,
      athletes.createdAt,
    )
    .orderBy(athletes.lastName, athletes.firstName)

  return rows.map((r) => ({ ...r, checkinCount: Number(r.checkinCount) }))
}

export interface AthleteEventRow {
  registrationId: string
  athleteId: string | null
  bibNumber: string
  firstName: string | null
  lastName: string | null
  status: 'active' | 'hidden' | 'inactive'
  registeredAt: Date
  stampCount: number
}

export interface AthleteStampRow {
  stampId: string
  stationId: string | null
  stationName: string | null
  stationType: string | null
  stampSource: 'check_in' | 'add_friend'
  stampedAt: Date
}

export interface AthleteEventDetailRow {
  registrationId: string
  athleteId: string | null
  bibNumber: string
  firstName: string | null
  lastName: string | null
  status: 'active' | 'hidden' | 'inactive'
  registeredAt: Date
  stamps: AthleteStampRow[]
}

export async function listAthletesByEvent(
  eventId: string,
): Promise<AthleteEventRow[]> {
  const rows = await db
    .select({
      registrationId: athleteEventRegistrations.registrationId,
      athleteId: athleteEventRegistrations.athleteId,
      bibNumber: athleteEventRegistrations.bibNumber,
      status: athleteEventRegistrations.status,
      registeredAt: athleteEventRegistrations.registeredAt,
      firstName: athletes.firstName,
      lastName: athletes.lastName,
      stampCount: count(stamps.stampId),
    })
    .from(athleteEventRegistrations)
    .leftJoin(
      athletes,
      eq(athleteEventRegistrations.athleteId, athletes.athleteId),
    )
    .leftJoin(
      stamps,
      and(
        eq(stamps.athleteId, athleteEventRegistrations.athleteId),
        eq(stamps.eventId, eventId),
      ),
    )
    .where(eq(athleteEventRegistrations.eventId, eventId))
    .groupBy(
      athleteEventRegistrations.registrationId,
      athleteEventRegistrations.athleteId,
      athleteEventRegistrations.bibNumber,
      athleteEventRegistrations.status,
      athleteEventRegistrations.registeredAt,
      athletes.firstName,
      athletes.lastName,
    )
    .orderBy(athleteEventRegistrations.bibNumber)

  return rows.map((r) => ({ ...r, stampCount: Number(r.stampCount) }))
}

export async function listAthletesWithStampsByEvent(
  eventId: string,
): Promise<AthleteEventDetailRow[]> {
  const [registrations, stampRows] = await Promise.all([
    db
      .select({
        registrationId: athleteEventRegistrations.registrationId,
        athleteId: athleteEventRegistrations.athleteId,
        bibNumber: athleteEventRegistrations.bibNumber,
        status: athleteEventRegistrations.status,
        registeredAt: athleteEventRegistrations.registeredAt,
        firstName: athletes.firstName,
        lastName: athletes.lastName,
      })
      .from(athleteEventRegistrations)
      .leftJoin(athletes, eq(athleteEventRegistrations.athleteId, athletes.athleteId))
      .where(eq(athleteEventRegistrations.eventId, eventId))
      .orderBy(athleteEventRegistrations.bibNumber),

    db
      .select({
        stampId: stamps.stampId,
        athleteId: stamps.athleteId,
        stationId: stamps.stationId,
        stationName: stations.stationName,
        stationType: stations.stationType,
        stampSource: stamps.stampSource,
        stampedAt: stamps.stampedAt,
      })
      .from(stamps)
      .leftJoin(stations, eq(stamps.stationId, stations.stationId))
      .where(eq(stamps.eventId, eventId))
      .orderBy(stamps.stampedAt),
  ])

  const stampsByAthleteId = new Map<string, AthleteStampRow[]>()
  for (const s of stampRows) {
    const list = stampsByAthleteId.get(s.athleteId) ?? []
    list.push({
      stampId: s.stampId,
      stationId: s.stationId,
      stationName: s.stationName,
      stationType: s.stationType,
      stampSource: s.stampSource,
      stampedAt: s.stampedAt,
    })
    stampsByAthleteId.set(s.athleteId, list)
  }

  return registrations.map((r) => ({
    ...r,
    stamps: r.athleteId ? (stampsByAthleteId.get(r.athleteId) ?? []) : [],
  }))
}
