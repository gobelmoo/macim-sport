import { getActiveEvents, getEventWithStations } from '@/db/queries/checkins'
import { StationSelector } from './_components/station-selector'

export const dynamic = 'force-dynamic'

export default async function CheckinIndexPage() {
  // Fetch all active events server-side
  const activeEvents = await getActiveEvents()

  // Pre-fetch stations for all active events so the client needs no extra
  // round-trips. For MVP, the number of active events will be small.
  const eventsWithStations = await Promise.all(
    activeEvents.map((e) => getEventWithStations(e.eventId)),
  )

  // Filter out any null results (shouldn't happen but keeps types clean)
  const data = eventsWithStations.filter(Boolean) as NonNullable<
    (typeof eventsWithStations)[number]
  >[]

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">MACIM SPORT</h1>
          <p className="mt-2 text-xl text-muted-foreground">ระบบ Check-in</p>
        </div>
        <StationSelector events={data} />
      </div>
    </div>
  )
}
