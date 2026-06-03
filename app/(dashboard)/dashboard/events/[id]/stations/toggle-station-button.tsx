'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleStationStatusAction } from '../actions'
import type { stationStatusEnum } from '@/db/schema/stations'

type Props = {
  stationId: string
  eventId: string
  currentStatus: (typeof stationStatusEnum.enumValues)[number]
}

export function ToggleStationButton({ stationId, eventId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await toggleStationStatusAction(stationId, eventId)
    })
  }

  return (
    <Button
      variant={currentStatus === 'active' ? 'outline' : 'secondary'}
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending
        ? 'กำลังอัปเดต...'
        : currentStatus === 'active'
          ? 'ปิดใช้งาน'
          : 'เปิดใช้งาน'}
    </Button>
  )
}
