'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { updateEventStatusAction } from './actions'
import type { eventStatusEnum } from '@/db/schema/events'

type EventStatus = (typeof eventStatusEnum.enumValues)[number]

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'แบบร่าง',
  published: 'เผยแพร่',
  active: 'กำลังจัดงาน',
  closed: 'ปิดแล้ว',
  archived: 'เก็บถาวร',
}

const ALL_STATUSES: EventStatus[] = ['draft', 'published', 'active', 'closed', 'archived']

type StatusButtonsProps = {
  eventId: string
  currentStatus: EventStatus
}

export function StatusButtons({ eventId, currentStatus }: StatusButtonsProps) {
  const [targetStatus, setTargetStatus] = useState<EventStatus | null>(null)
  const [pending, setPending] = useState(false)

  const otherStatuses = ALL_STATUSES.filter((s) => s !== currentStatus)

  async function handleConfirm() {
    if (!targetStatus) return
    setPending(true)
    await updateEventStatusAction(eventId, targetStatus)
    setPending(false)
    setTargetStatus(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            เปลี่ยนสถานะ
            <ChevronDown className="ml-1 size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {otherStatuses.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => setTargetStatus(s)}>
              {STATUS_LABEL[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!targetStatus} onOpenChange={(open) => { if (!open) setTargetStatus(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เปลี่ยนสถานะเป็น &ldquo;{targetStatus ? STATUS_LABEL[targetStatus] : ''}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              สถานะปัจจุบัน: {STATUS_LABEL[currentStatus]} → {targetStatus ? STATUS_LABEL[targetStatus] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={pending}>
              {pending ? 'กำลังอัปเดต...' : 'ยืนยัน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
