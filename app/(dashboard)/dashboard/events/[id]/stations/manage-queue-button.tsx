'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { openStationQueueAction } from './queue-actions'

type Props = {
  stationId: string
  eventId: string
}

export function ManageQueueButton({ stationId, eventId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await openStationQueueAction(eventId, stationId)
    })
  }

  return (
    <Button variant="secondary" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? 'กำลังเปิด...' : 'จัดการคิว'}
    </Button>
  )
}
