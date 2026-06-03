'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { EventWithStations } from '@/db/queries/checkins'

interface Props {
  events: EventWithStations[]
}

export function StationSelector({ events }: Props) {
  const router = useRouter()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  )

  const selectedEvent = events.find((e) => e.eventId === selectedEventId)

  function handleEventSelect(eventId: string) {
    setSelectedEventId(eventId)
    setSelectedStationId(null)
  }

  function handleStart() {
    if (!selectedStationId || !selectedEventId) return
    router.push(`/checkin/${selectedStationId}?eventId=${selectedEventId}`)
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">ไม่มีอีเวนต์ที่เปิดใช้งาน</CardTitle>
          <CardDescription className="text-lg">
            กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานอีเวนต์
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 — Event */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">1. เลือกอีเวนต์</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {events.map((event) => (
            <button
              key={event.eventId}
              onClick={() => handleEventSelect(event.eventId)}
              className={[
                'flex w-full flex-col rounded-xl border-2 px-6 py-5 text-left transition-colors',
                selectedEventId === event.eventId
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50',
              ].join(' ')}
            >
              <span className="text-2xl font-semibold">{event.eventName}</span>
              <span className="mt-1 text-lg text-muted-foreground">
                {event.eventCity} · {event.startDate}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Step 2 — Station (only shown after an event is selected) */}
      {selectedEvent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">2. เลือกสถานี</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selectedEvent.stations.length === 0 ? (
              <p className="text-lg text-muted-foreground">
                ไม่มีสถานีที่เปิดใช้งานในอีเวนต์นี้
              </p>
            ) : (
              selectedEvent.stations.map((station) => (
                <button
                  key={station.stationId}
                  onClick={() => setSelectedStationId(station.stationId)}
                  className={[
                    'flex w-full rounded-xl border-2 px-6 py-5 text-left transition-colors',
                    selectedStationId === station.stationId
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  ].join(' ')}
                >
                  <span className="text-2xl font-semibold">
                    {station.stationName}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Start button */}
      {selectedStationId && (
        <Button
          size="lg"
          className="h-16 w-full text-xl"
          onClick={handleStart}
        >
          เริ่มต้น Check-in
        </Button>
      )}
    </div>
  )
}
