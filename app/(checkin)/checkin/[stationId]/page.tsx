import { redirect } from 'next/navigation'
import { getStation } from '@/db/queries/stations'
import { getEvent } from '@/db/queries/events'
import { CheckinTerminal } from './_components/checkin-terminal'

interface Props {
  params: Promise<{ stationId: string }>
  searchParams: Promise<{ eventId?: string }>
}

export const dynamic = 'force-dynamic'

export default async function CheckinStationPage({ params, searchParams }: Props) {
  const { stationId } = await params
  const { eventId } = await searchParams

  if (!eventId) redirect('/checkin')

  // Validate station and event exist
  const [station, event] = await Promise.all([
    getStation(stationId),
    getEvent(eventId),
  ])

  if (!station || station.status !== 'active') redirect('/checkin')
  if (!event || event.status !== 'active') redirect('/checkin')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {event.eventName}
            </p>
            <h1 className="text-2xl font-bold">{station.stationName}</h1>
          </div>
          <a
            href="/checkin"
            className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            เปลี่ยนสถานี
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center p-8">
        <CheckinTerminal stationId={stationId} eventId={eventId} />
      </main>
    </div>
  )
}
