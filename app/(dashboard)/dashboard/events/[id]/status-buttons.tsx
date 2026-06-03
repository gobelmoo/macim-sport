'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateEventStatusAction } from './actions'
import type { eventStatusEnum } from '@/db/schema/events'

type EventStatus = (typeof eventStatusEnum.enumValues)[number]

const STATUS_TRANSITIONS: Partial<Record<EventStatus, EventStatus>> = {
  draft: 'published',
  published: 'active',
  active: 'closed',
}

const STATUS_BUTTON_LABEL: Partial<Record<EventStatus, string>> = {
  draft: 'เผยแพร่ (Publish)',
  published: 'เปิดงาน (Activate)',
  active: 'ปิดงาน (Close)',
}

type StatusButtonsProps = {
  eventId: string
  currentStatus: EventStatus
}

export function StatusButtons({ eventId, currentStatus }: StatusButtonsProps) {
  const [isPending, startTransition] = useTransition()

  const nextStatus = STATUS_TRANSITIONS[currentStatus]
  if (!nextStatus) return null

  const label = STATUS_BUTTON_LABEL[currentStatus] ?? nextStatus

  function handleClick() {
    startTransition(async () => {
      await updateEventStatusAction(eventId, nextStatus!)
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? 'กำลังอัปเดต...' : label}
    </Button>
  )
}
