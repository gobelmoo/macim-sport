import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { athletes } from '@/db/schema/athletes'
import { queueCounters, queueEntries } from '@/db/schema/queue'
import { stations } from '@/db/schema/stations'
import { nextRollingAverage, requeueSortSeq, estimateWaitSeconds } from '@/lib/queue-core'

const ACTIVE_STATUSES = ['waiting', 'serving', 'skipped'] as const

export type CounterRow = {
  counterId: string
  eventId: string
  stationId: string
  counterName: string
  isOpen: boolean
  sessionId: string
  lastDisplayNumber: number
  avgServiceSeconds: number | null
}

export type EntryView = {
  entryId: string
  displayNumber: number
  sortSeq: number
  entryStatus: 'waiting' | 'serving' | 'done' | 'skipped' | 'cancelled'
  bibNumber: string | null
  displayLabel: string | null
  isNonMember: boolean
  athleteName: string | null
}

export type BoardData = {
  counter: CounterRow
  serving: EntryView | null
  upcoming: EntryView[]
  skipped: EntryView[]
  waitingCount: number
}

export type QueueStatus = {
  counterName: string
  displayNumber: number
  entryStatus: EntryView['entryStatus']
  peopleAhead: number
  etaSeconds: number
  sessionValid: boolean
}

// ─── Counters ────────────────────────────────────────────────────────────────

/**
 * คืน counterId ของ station (1 station = 1 counter). ถ้ายังไม่มี counter
 * → สร้างใหม่ (ชื่อ = ชื่อ station). คืน null ถ้าหา station ไม่เจอ.
 */
export async function getOrCreateCounterForStation(
  stationId: string,
): Promise<string | null> {
  const [station] = await db
    .select({
      stationId: stations.stationId,
      stationName: stations.stationName,
      eventId: stations.eventId,
    })
    .from(stations)
    .where(eq(stations.stationId, stationId))
    .limit(1)
  if (!station) return null

  const [existing] = await db
    .select({ counterId: queueCounters.counterId })
    .from(queueCounters)
    .where(eq(queueCounters.stationId, stationId))
    .limit(1)
  if (existing) return existing.counterId

  const [created] = await db
    .insert(queueCounters)
    .values({
      eventId: station.eventId,
      stationId,
      counterName: station.stationName,
    })
    .onConflictDoNothing()
    .returning({ counterId: queueCounters.counterId })
  if (created) return created.counterId

  // ชน unique index (race) → re-select
  const [row] = await db
    .select({ counterId: queueCounters.counterId })
    .from(queueCounters)
    .where(eq(queueCounters.stationId, stationId))
    .limit(1)
  return row?.counterId ?? null
}

export async function getCounter(counterId: string): Promise<CounterRow | null> {
  const [row] = await db
    .select({
      counterId: queueCounters.counterId,
      eventId: queueCounters.eventId,
      stationId: queueCounters.stationId,
      counterName: queueCounters.counterName,
      isOpen: queueCounters.isOpen,
      sessionId: queueCounters.sessionId,
      lastDisplayNumber: queueCounters.lastDisplayNumber,
      avgServiceSeconds: queueCounters.avgServiceSeconds,
    })
    .from(queueCounters)
    .where(eq(queueCounters.counterId, counterId))
    .limit(1)
  return row ?? null
}

export async function deleteCounter(counterId: string): Promise<void> {
  await db.delete(queueCounters).where(eq(queueCounters.counterId, counterId))
}

export async function setCounterOpen(
  counterId: string,
  isOpen: boolean,
): Promise<void> {
  await db
    .update(queueCounters)
    .set({ isOpen })
    .where(eq(queueCounters.counterId, counterId))
}

export async function resetCounter(counterId: string): Promise<void> {
  // ยกเลิก entry ที่ค้างทั้งหมดของ counter
  await db
    .update(queueEntries)
    .set({ entryStatus: 'cancelled' })
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        inArray(queueEntries.entryStatus, [...ACTIVE_STATUSES]),
      ),
    )
  // เริ่ม session ใหม่ + รีเซ็ตตัวนับ + ล้างค่าเฉลี่ย
  await db
    .update(queueCounters)
    .set({
      sessionId: crypto.randomUUID(),
      lastDisplayNumber: 0,
      avgServiceSeconds: null,
    })
    .where(eq(queueCounters.counterId, counterId))
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export type EnqueueInput = {
  counterId: string
  athleteId?: string | null
  registrationId?: string | null
  bibNumber?: string | null
  lineUserId?: string | null
  isNonMember?: boolean
  displayLabel?: string | null
}

export type EnqueuedEntry = {
  entryId: string
  displayNumber: number
  statusToken: string
}

async function findActiveEntry(
  counterId: string,
  athleteId: string | null,
  bibNumber: string | null,
): Promise<EnqueuedEntry | null> {
  if (!athleteId && !bibNumber) return null
  const match = athleteId
    ? eq(queueEntries.athleteId, athleteId)
    : eq(queueEntries.bibNumber, bibNumber as string)
  const [row] = await db
    .select({
      entryId: queueEntries.entryId,
      displayNumber: queueEntries.displayNumber,
      statusToken: queueEntries.statusToken,
    })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        inArray(queueEntries.entryStatus, [...ACTIVE_STATUSES]),
        match,
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * ออกเลขคิวใหม่. ป้องกันเลขซ้ำด้วยการ increment lastDisplayNumber แบบ atomic
 * และกันคิวซ้ำต่อ athlete/bib ด้วย partial unique index (คืน entry เดิมถ้าซ้ำ).
 */
export async function enqueue(
  input: EnqueueInput,
): Promise<{ entry: EnqueuedEntry; created: boolean }> {
  const athleteId = input.athleteId ?? null
  const bibNumber = input.bibNumber ?? null

  const existing = await findActiveEntry(input.counterId, athleteId, bibNumber)
  if (existing) return { entry: existing, created: false }

  // increment ตัวนับแบบ atomic แล้วใช้ค่าที่ได้เป็น displayNumber + sortSeq
  const [counter] = await db
    .update(queueCounters)
    .set({ lastDisplayNumber: sql`${queueCounters.lastDisplayNumber} + 1` })
    .where(eq(queueCounters.counterId, input.counterId))
    .returning({
      n: queueCounters.lastDisplayNumber,
      sessionId: queueCounters.sessionId,
    })

  try {
    const [entry] = await db
      .insert(queueEntries)
      .values({
        counterId: input.counterId,
        sessionId: counter.sessionId,
        displayNumber: counter.n,
        sortSeq: counter.n,
        entryStatus: 'waiting',
        athleteId,
        registrationId: input.registrationId ?? null,
        bibNumber,
        lineUserId: input.lineUserId ?? null,
        isNonMember: input.isNonMember ?? false,
        displayLabel: input.displayLabel ?? null,
      })
      .returning({
        entryId: queueEntries.entryId,
        displayNumber: queueEntries.displayNumber,
        statusToken: queueEntries.statusToken,
      })
    return { entry, created: true }
  } catch (err) {
    // ชน partial unique index = มีคนขอคิวเดียวกันพร้อมกัน → คืนตัวที่มีอยู่
    const dup = await findActiveEntry(input.counterId, athleteId, bibNumber)
    if (dup) return { entry: dup, created: false }
    throw err
  }
}

// ─── Board + operations ──────────────────────────────────────────────────────

const ENTRY_VIEW_COLUMNS = {
  entryId: queueEntries.entryId,
  displayNumber: queueEntries.displayNumber,
  sortSeq: queueEntries.sortSeq,
  entryStatus: queueEntries.entryStatus,
  bibNumber: queueEntries.bibNumber,
  displayLabel: queueEntries.displayLabel,
  isNonMember: queueEntries.isNonMember,
  athleteName: athletes.firstName,
} as const

function toEntryView(row: {
  entryId: string
  displayNumber: number
  sortSeq: number
  entryStatus: EntryView['entryStatus']
  bibNumber: string | null
  displayLabel: string | null
  isNonMember: boolean
  athleteName: string | null
}): EntryView {
  return row
}

async function entriesByStatus(
  counterId: string,
  sessionId: string,
  status: EntryView['entryStatus'],
  limit?: number,
): Promise<EntryView[]> {
  const q = db
    .select(ENTRY_VIEW_COLUMNS)
    .from(queueEntries)
    .leftJoin(athletes, eq(queueEntries.athleteId, athletes.athleteId))
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        eq(queueEntries.sessionId, sessionId),
        eq(queueEntries.entryStatus, status),
      ),
    )
    .orderBy(asc(queueEntries.sortSeq))
  const rows = limit ? await q.limit(limit) : await q
  return rows.map(toEntryView)
}

export async function getBoard(counterId: string): Promise<BoardData | null> {
  const counter = await getCounter(counterId)
  if (!counter) return null
  const [servingList, upcoming, skipped, waitingAll] = await Promise.all([
    entriesByStatus(counterId, counter.sessionId, 'serving', 1),
    entriesByStatus(counterId, counter.sessionId, 'waiting', 3),
    entriesByStatus(counterId, counter.sessionId, 'skipped'),
    entriesByStatus(counterId, counter.sessionId, 'waiting'),
  ])
  return {
    counter,
    serving: servingList[0] ?? null,
    upcoming,
    skipped,
    waitingCount: waitingAll.length,
  }
}

/** ปิดคิวที่กำลัง serve (done) + อัปเดตค่าเฉลี่ย แล้วเรียก waiting ตัวถัดไป */
export async function nextQueue(counterId: string): Promise<void> {
  const counter = await getCounter(counterId)
  if (!counter) return

  // ปิด serving ปัจจุบัน
  const [serving] = await db
    .select({
      entryId: queueEntries.entryId,
      calledAt: queueEntries.calledAt,
    })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        eq(queueEntries.sessionId, counter.sessionId),
        eq(queueEntries.entryStatus, 'serving'),
      ),
    )
    .limit(1)

  if (serving) {
    const now = new Date()
    await db
      .update(queueEntries)
      .set({ entryStatus: 'done', completedAt: now })
      .where(eq(queueEntries.entryId, serving.entryId))
    if (serving.calledAt) {
      const sample = (now.getTime() - serving.calledAt.getTime()) / 1000
      const avg = nextRollingAverage(counter.avgServiceSeconds, sample)
      await db
        .update(queueCounters)
        .set({ avgServiceSeconds: avg })
        .where(eq(queueCounters.counterId, counterId))
    }
  }

  // เรียก waiting ตัวแรก (sortSeq น้อยสุด)
  const [next] = await db
    .select({ entryId: queueEntries.entryId })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        eq(queueEntries.sessionId, counter.sessionId),
        eq(queueEntries.entryStatus, 'waiting'),
      ),
    )
    .orderBy(asc(queueEntries.sortSeq))
    .limit(1)

  if (next) {
    await db
      .update(queueEntries)
      .set({ entryStatus: 'serving', calledAt: new Date() })
      .where(eq(queueEntries.entryId, next.entryId))
  }
}

export async function skipEntry(entryId: string): Promise<void> {
  await db
    .update(queueEntries)
    .set({ entryStatus: 'skipped' })
    .where(eq(queueEntries.entryId, entryId))
}

/** แทรกคิวที่ถูกข้ามกลับมาเป็นลำดับถัดไป */
export async function requeueEntry(entryId: string): Promise<void> {
  const [entry] = await db
    .select({
      counterId: queueEntries.counterId,
      sessionId: queueEntries.sessionId,
    })
    .from(queueEntries)
    .where(eq(queueEntries.entryId, entryId))
    .limit(1)
  if (!entry) return

  const [serving] = await db
    .select({ sortSeq: queueEntries.sortSeq })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, entry.counterId),
        eq(queueEntries.sessionId, entry.sessionId),
        eq(queueEntries.entryStatus, 'serving'),
      ),
    )
    .limit(1)

  const [minWaiting] = await db
    .select({ sortSeq: queueEntries.sortSeq })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, entry.counterId),
        eq(queueEntries.sessionId, entry.sessionId),
        eq(queueEntries.entryStatus, 'waiting'),
      ),
    )
    .orderBy(asc(queueEntries.sortSeq))
    .limit(1)

  const newSeq = requeueSortSeq(
    serving?.sortSeq ?? null,
    minWaiting?.sortSeq ?? null,
  )
  await db
    .update(queueEntries)
    .set({ entryStatus: 'waiting', sortSeq: newSeq })
    .where(eq(queueEntries.entryId, entryId))
}

// ─── Status (public poll) ────────────────────────────────────────────────────

export async function getQueueStatus(
  statusToken: string,
): Promise<QueueStatus | null> {
  const [entry] = await db
    .select({
      counterId: queueEntries.counterId,
      sessionId: queueEntries.sessionId,
      displayNumber: queueEntries.displayNumber,
      sortSeq: queueEntries.sortSeq,
      entryStatus: queueEntries.entryStatus,
    })
    .from(queueEntries)
    .where(eq(queueEntries.statusToken, statusToken))
    .limit(1)
  if (!entry) return null

  const counter = await getCounter(entry.counterId)
  if (!counter) return null

  const sessionValid = entry.sessionId === counter.sessionId

  if (!sessionValid || entry.entryStatus !== 'waiting') {
    return {
      counterName: counter.counterName,
      displayNumber: entry.displayNumber,
      entryStatus: entry.entryStatus,
      peopleAhead: 0,
      etaSeconds: 0,
      sessionValid,
    }
  }

  const [ahead] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, entry.counterId),
        eq(queueEntries.sessionId, entry.sessionId),
        eq(queueEntries.entryStatus, 'waiting'),
        lt(queueEntries.sortSeq, entry.sortSeq),
      ),
    )
  const peopleAhead = ahead?.count ?? 0

  return {
    counterName: counter.counterName,
    displayNumber: entry.displayNumber,
    entryStatus: entry.entryStatus,
    peopleAhead,
    etaSeconds: estimateWaitSeconds(peopleAhead, counter.avgServiceSeconds),
    sessionValid,
  }
}
