import { notFound } from 'next/navigation'
import { verifyStationToken } from '@/lib/station-token'
import { db } from '@/db'
import { events } from '@/db/schema/events'
import { stations } from '@/db/schema/stations'
import { eq } from 'drizzle-orm'
import { OcrTerminal } from './_components/ocr-terminal'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SelfCheckinPage({ params }: Props) {
  const { token } = await params

  const payload = await verifyStationToken(token)
  if (!payload) notFound()

  const [eventRow, stationRow] = await Promise.all([
    db.select({ eventName: events.eventName })
      .from(events)
      .where(eq(events.eventId, payload.eventId))
      .limit(1)
      .then((r) => r[0]),
    db.select({ stationName: stations.stationName, status: stations.status })
      .from(stations)
      .where(eq(stations.stationId, payload.stationId))
      .limit(1)
      .then((r) => r[0]),
  ])

  if (!eventRow || !stationRow) notFound()
  if (stationRow.status !== 'active') notFound()

  return (
    <OcrTerminal
      token={token}
      eventName={eventRow.eventName}
      stationName={stationRow.stationName}
    />
  )
}
