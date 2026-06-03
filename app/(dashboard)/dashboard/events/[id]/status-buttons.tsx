'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateEventStatusAction } from './actions'
import type { eventStatusEnum } from '@/db/schema/events'

type EventStatus = (typeof eventStatusEnum.enumValues)[number]

const STATUS_CONFIG: Partial<Record<EventStatus, {
  next: EventStatus
  label: string
  title: string
  description: string
  action: string
}>> = {
  draft: {
    next: 'published',
    label: 'เผยแพร่ (Publish)',
    title: 'ยืนยันการเผยแพร่',
    description: 'งานจะถูกเผยแพร่และผู้ใช้จะสามารถมองเห็นได้ คุณแน่ใจหรือไม่?',
    action: 'ยืนยันเผยแพร่',
  },
  published: {
    next: 'active',
    label: 'เปิดงาน (Activate)',
    title: 'ยืนยันการเปิดงาน',
    description: 'งานจะเปลี่ยนเป็นสถานะ Active และระบบ check-in จะพร้อมใช้งาน คุณแน่ใจหรือไม่?',
    action: 'ยืนยันเปิดงาน',
  },
  active: {
    next: 'closed',
    label: 'ปิดงาน (Close)',
    title: 'ยืนยันการปิดงาน',
    description: 'เมื่อปิดงานแล้วจะไม่สามารถ check-in เพิ่มเติมได้อีก คุณแน่ใจหรือไม่ว่าต้องการปิดงานนี้?',
    action: 'ยืนยันปิดงาน',
  },
}

type StatusButtonsProps = {
  eventId: string
  currentStatus: EventStatus
}

export function StatusButtons({ eventId, currentStatus }: StatusButtonsProps) {
  const [isPending, startTransition] = useTransition()

  const cfg = STATUS_CONFIG[currentStatus]
  if (!cfg) return null

  function handleConfirm() {
    startTransition(async () => {
      await updateEventStatusAction(eventId, cfg!.next)
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? 'กำลังอัปเดต...' : cfg.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{cfg.title}</AlertDialogTitle>
          <AlertDialogDescription>{cfg.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {cfg.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
