import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { lineSessions, lineStateEnum, athleteConsents } from '@/db/schema/line'
import { athletes } from '@/db/schema/athletes'
import { events } from '@/db/schema/events'
import { athleteEventRegistrations } from '@/db/schema/athlete_event_registrations'

export type LineState = (typeof lineStateEnum.enumValues)[number]

export interface LineSession {
  lineUserId: string
  state: LineState
  eventId: string | null
  bibNumber: string | null
  updatedAt: Date
}

export interface ActiveEvent {
  eventId: string
  eventName: string
  startDate: string
  endDate: string
}

export interface RegistrationRow {
  registrationId: string
  athleteId: string | null
  bibNumber: string
  eventId: string
  athleteFirstName: string | null
  athleteLastName: string | null
  athleteDateOfBirth: string | null
  athleteLineUserId: string | null
}

// ─── Session ───────────────────────────────────────────────────────────────

export async function getLineSession(lineUserId: string): Promise<LineSession | null> {
  const rows = await db
    .select()
    .from(lineSessions)
    .where(eq(lineSessions.lineUserId, lineUserId))
    .limit(1)
  return rows[0] ?? null
}

export async function upsertLineSession(
  lineUserId: string,
  data: Partial<Omit<LineSession, 'lineUserId' | 'updatedAt'>>,
): Promise<void> {
  const now = new Date()
  await db
    .insert(lineSessions)
    .values({ lineUserId, state: 'idle', ...data, updatedAt: now })
    .onConflictDoUpdate({
      target: lineSessions.lineUserId,
      set: { ...data, updatedAt: now },
    })
}

// ─── Athletes ──────────────────────────────────────────────────────────────

export async function getAthleteByLineUserId(lineUserId: string) {
  const rows = await db
    .select()
    .from(athletes)
    .where(eq(athletes.lineUserId, lineUserId))
    .limit(1)
  return rows[0] ?? null
}

export async function linkAthleteLineId(athleteId: string, lineUserId: string): Promise<void> {
  await db
    .update(athletes)
    .set({ lineUserId })
    .where(eq(athletes.athleteId, athleteId))
}

// ─── Events ────────────────────────────────────────────────────────────────

export async function getActiveEvents(): Promise<ActiveEvent[]> {
  return db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      startDate: events.startDate,
      endDate: events.endDate,
    })
    .from(events)
    .where(inArray(events.status, ['published', 'active']))
    .orderBy(events.startDate)
}

export async function getRegisteredEventIds(athleteId: string): Promise<string[]> {
  const rows = await db
    .select({ eventId: athleteEventRegistrations.eventId })
    .from(athleteEventRegistrations)
    .where(eq(athleteEventRegistrations.athleteId, athleteId))
  return rows.map((r) => r.eventId)
}

// ─── Registrations ─────────────────────────────────────────────────────────

export async function getRegistrationByBibAndEvent(
  bibNumber: string,
  eventId: string,
): Promise<RegistrationRow | null> {
  const rows = await db
    .select({
      registrationId: athleteEventRegistrations.registrationId,
      athleteId: athleteEventRegistrations.athleteId,
      bibNumber: athleteEventRegistrations.bibNumber,
      eventId: athleteEventRegistrations.eventId,
      athleteFirstName: athletes.firstName,
      athleteLastName: athletes.lastName,
      athleteDateOfBirth: athletes.dateOfBirth,
      athleteLineUserId: athletes.lineUserId,
    })
    .from(athleteEventRegistrations)
    .leftJoin(athletes, eq(athleteEventRegistrations.athleteId, athletes.athleteId))
    .where(
      and(
        eq(athleteEventRegistrations.bibNumber, bibNumber),
        eq(athleteEventRegistrations.eventId, eventId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function insertAthleteConsent(athleteId: string): Promise<void> {
  await db.insert(athleteConsents).values({
    athleteId,
    consentVersion: '2025-v1',
    pdpaAccepted: true,
    marketingAccepted: false,
  })
}

// ─── Registration (called from LIFF server action) ─────────────────────────

export async function createAthleteAndRegistration(data: {
  lineUserId: string
  eventId: string
  bibNumber: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: 'male' | 'female' | 'other'
}): Promise<{ athleteId: string }> {
  const athleteId = crypto.randomUUID()
  await db.insert(athletes).values({
    athleteId,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    lineUserId: data.lineUserId,
    status: 'active',
  })
  await db.insert(athleteEventRegistrations).values({
    registrationId: crypto.randomUUID(),
    athleteId,
    eventId: data.eventId,
    bibNumber: data.bibNumber,
    status: 'active',
  })
  return { athleteId }
}

export async function createRegistrationForExistingAthlete(data: {
  athleteId: string
  eventId: string
  bibNumber: string
}): Promise<void> {
  await db
    .insert(athleteEventRegistrations)
    .values({
      registrationId: crypto.randomUUID(),
      athleteId: data.athleteId,
      eventId: data.eventId,
      bibNumber: data.bibNumber,
      status: 'active',
    })
    .onConflictDoNothing()
}

export async function getEventById(eventId: string) {
  const rows = await db
    .select({ eventId: events.eventId, eventName: events.eventName })
    .from(events)
    .where(eq(events.eventId, eventId))
    .limit(1)
  return rows[0] ?? null
}
