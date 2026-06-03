import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stations } from '@/db/schema/stations'
import type { stationTypeEnum } from '@/db/schema/stations'

export type StationRow = {
  stationId: string
  eventId: string
  stationType: (typeof stationTypeEnum.enumValues)[number]
  stationName: string
  stampOnAddFriend: boolean
  status: 'active' | 'hidden'
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

export async function getStation(
  stationId: string,
): Promise<StationRow | undefined> {
  const [row] = await db
    .select()
    .from(stations)
    .where(eq(stations.stationId, stationId))
    .limit(1)

  return row
}

export async function createStation(
  data: CreateStationData,
): Promise<{ stationId: string }> {
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

export async function hideStation(
  stationId: string,
): Promise<{ stationId: string }> {
  const [row] = await db
    .update(stations)
    .set({ status: 'hidden' })
    .where(eq(stations.stationId, stationId))
    .returning({ stationId: stations.stationId })

  return row
}
