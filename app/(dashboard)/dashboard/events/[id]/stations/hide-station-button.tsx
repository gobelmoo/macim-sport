'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { hideStationAction } from '../actions'

type HideStationButtonProps = {
  stationId: string
  eventId: string
}

export function HideStationButton({ stationId, eventId }: HideStationButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await hideStationAction(stationId, eventId)
    })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? 'กำลังซ่อน...' : 'ซ่อน'}
    </Button>
  )
}
