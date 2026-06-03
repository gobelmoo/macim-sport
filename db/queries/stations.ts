import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stations } from '@/db/schema/stations'
import type { stationStatusEnum, stationTypeEnum } from '@/db/schema/stations'

export type StationRow = {
  stationId: string
  eventId: string
  stationType: (typeof stationTypeEnum.enumValues)[number]
  stationName: string
  stampOnAddFriend: boolean
  status: (typeof stationStatusEnum.enumValues)[number]
  createdAt: Date
}

export type CreateStationData = {
  eventId: string
  stationType: (typeof stationTypeEnum.enumValues)[number]
  stationName: string
  stampOnAddFriend: boolean
}

export type UpdateStationData = Partial<Omit<CreateStationData, 'eventId'>>

export async function listStations(eventId: string): Promise<StationRow[]> {
  return db
    .select()
    .from(stations)
    .where(eq(stations.eventId, eventId))
    .orderBy(stations.createdAt)
}

export async function getStation(stationId: string): Promise<StationRow | undefined> {
  const [row] = await db
    .select()
    .from(stations)
    .where(eq(stations.stationId, stationId))
    .limit(1)

  return row
}

export async function createStation(data: CreateStationData): Promise<{ stationId: string }> {
  const [row] = await db
    .insert(stations)
    .values(data)
    .returning({ stationId: stations.stationId })

  return row
}

export async function updateStation(
  stationId: string,
  data: UpdateStationData,
): Promise<{ stationId: string }> {
  const [row] = await db
    .update(stations)
    .set(data)
    .where(eq(stations.stationId, stationId))
    .returning({ stationId: stations.stationId })

  return row
}

export async function toggleStationStatus(
  stationId: string,
  currentStatus: (typeof stationStatusEnum.enumValues)[number],
): Promise<{ stationId: string }> {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
  const [row] = await db
    .update(stations)
    .set({ status: nextStatus })
    .where(eq(stations.stationId, stationId))
    .returning({ stationId: stations.stationId })

  return row
}

export async function deleteStation(stationId: string): Promise<void> {
  await db.delete(stations).where(eq(stations.stationId, stationId))
}
