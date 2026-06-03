import { and, count, countDistinct, desc, eq, gte } from 'drizzle-orm'
import { db } from '@/db'
import { athletes } from '@/db/schema/athletes'
import { checkins } from '@/db/schema/checkins'
import { events } from '@/db/schema/events'
import { stamps } from '@/db/schema/stamps'
import { stations } from '@/db/schema/stations'

export interface CheckinStats {
  totalCheckins: number
  totalAthletes: number
  totalStamps: number
  /** Athletes whose account was created in the last 30 days */
  newAthletes: number
}

export interface CheckinsByEvent {
  eventName: string
  checkinCount: number
  stampCount: number
}

export interface RecentCheckin {
  checkinId: string
  athleteFirstName: string
  athleteLastName: string
  bibNumber: string
  eventName: string
  stationName: string
  checkedInAt: Date
}

export async function getCheckinStats(opts?: {
  sponsorId?: string
}): Promise<CheckinStats> {
  const sponsorId = opts?.sponsorId
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [totalCheckinsResult, totalAthletesResult, totalStampsResult, newAthletesResult] =
    await Promise.all([
      sponsorId
        ? db
            .select({ value: count() })
            .from(checkins)
            .innerJoin(events, eq(checkins.eventId, events.eventId))
            .where(eq(events.sponsorId, sponsorId))
        : db.select({ value: count() }).from(checkins),

      sponsorId
        ? db
            .select({ value: countDistinct(checkins.athleteId) })
            .from(checkins)
            .innerJoin(events, eq(checkins.eventId, events.eventId))
            .where(eq(events.sponsorId, sponsorId))
        : db.select({ value: countDistinct(checkins.athleteId) }).from(checkins),

      sponsorId
        ? db
            .select({ value: count() })
            .from(stamps)
            .where(eq(stamps.sponsorId, sponsorId))
        : db.select({ value: count() }).from(stamps),

      sponsorId
        ? db
            .select({ value: countDistinct(checkins.athleteId) })
            .from(checkins)
            .innerJoin(events, eq(checkins.eventId, events.eventId))
            .innerJoin(athletes, eq(checkins.athleteId, athletes.athleteId))
            .where(
              and(
                eq(events.sponsorId, sponsorId),
                gte(athletes.createdAt, thirtyDaysAgo),
              ),
            )
        : db.select({ value: count() }).from(athletes).where(gte(athletes.createdAt, thirtyDaysAgo)),
    ])

  return {
    totalCheckins: Number(totalCheckinsResult[0]?.value ?? 0),
    totalAthletes: Number(totalAthletesResult[0]?.value ?? 0),
    totalStamps: Number(totalStampsResult[0]?.value ?? 0),
    newAthletes: Number(newAthletesResult[0]?.value ?? 0),
  }
}

export async function getCheckinsByEvent(opts?: {
  sponsorId?: string
}): Promise<CheckinsByEvent[]> {
  const sponsorId = opts?.sponsorId

  const [checkinRows, stampRows] = await Promise.all([
    sponsorId
      ? db
          .select({
            eventId: events.eventId,
            eventName: events.eventName,
            checkinCount: count(checkins.checkinId),
          })
          .from(events)
          .leftJoin(checkins, eq(checkins.eventId, events.eventId))
          .where(eq(events.sponsorId, sponsorId))
          .groupBy(events.eventId, events.eventName)
          .orderBy(desc(count(checkins.checkinId)))
      : db
          .select({
            eventId: events.eventId,
            eventName: events.eventName,
            checkinCount: count(checkins.checkinId),
          })
          .from(events)
          .leftJoin(checkins, eq(checkins.eventId, events.eventId))
          .groupBy(events.eventId, events.eventName)
          .orderBy(desc(count(checkins.checkinId))),

    sponsorId
      ? db
          .select({ eventId: stamps.eventId, stampCount: count(stamps.stampId) })
          .from(stamps)
          .where(eq(stamps.sponsorId, sponsorId))
          .groupBy(stamps.eventId)
      : db
          .select({ eventId: stamps.eventId, stampCount: count(stamps.stampId) })
          .from(stamps)
          .groupBy(stamps.eventId),
  ])

  const stampMap = new Map(
    stampRows.map((r) => [r.eventId, Number(r.stampCount)]),
  )

  return checkinRows.map((row) => ({
    eventName: row.eventName,
    checkinCount: Number(row.checkinCount),
    stampCount: stampMap.get(row.eventId) ?? 0,
  }))
}

export async function getRecentCheckins(opts?: {
  sponsorId?: string
  limit?: number
}): Promise<RecentCheckin[]> {
  const sponsorId = opts?.sponsorId
  const limit = opts?.limit ?? 20

  const rows = sponsorId
    ? await db
        .select({
          checkinId: checkins.checkinId,
          athleteFirstName: athletes.firstName,
          athleteLastName: athletes.lastName,
          bibNumber: checkins.bibNumber,
          eventName: events.eventName,
          stationName: stations.stationName,
          checkedInAt: checkins.checkedInAt,
        })
        .from(checkins)
        .innerJoin(athletes, eq(checkins.athleteId, athletes.athleteId))
        .innerJoin(events, eq(checkins.eventId, events.eventId))
        .innerJoin(stations, eq(checkins.stationId, stations.stationId))
        .where(eq(events.sponsorId, sponsorId))
        .orderBy(desc(checkins.checkedInAt))
        .limit(limit)
    : await db
        .select({
          checkinId: checkins.checkinId,
          athleteFirstName: athletes.firstName,
          athleteLastName: athletes.lastName,
          bibNumber: checkins.bibNumber,
          eventName: events.eventName,
          stationName: stations.stationName,
          checkedInAt: checkins.checkedInAt,
        })
        .from(checkins)
        .innerJoin(athletes, eq(checkins.athleteId, athletes.athleteId))
        .innerJoin(events, eq(checkins.eventId, events.eventId))
        .innerJoin(stations, eq(checkins.stationId, stations.stationId))
        .orderBy(desc(checkins.checkedInAt))
        .limit(limit)

  return rows.map((row) => ({
    checkinId: row.checkinId,
    athleteFirstName: row.athleteFirstName,
    athleteLastName: row.athleteLastName,
    bibNumber: row.bibNumber,
    eventName: row.eventName,
    stationName: row.stationName,
    checkedInAt: row.checkedInAt,
  }))
}
