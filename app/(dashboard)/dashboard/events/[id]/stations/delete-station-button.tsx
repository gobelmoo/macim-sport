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
import { deleteStationAction } from '../actions'

type Props = {
  stationId: string
  eventId: string
  stationName: string
}

export function DeleteStationButton({ stationId, eventId, stationName }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteStationAction(stationId, eventId)
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? 'กำลังลบ...' : 'ลบ'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันการลบ Station</AlertDialogTitle>
          <AlertDialogDescription>
            ลบ &ldquo;{stationName}&rdquo; ออกจากระบบถาวร ข้อมูล check-in ที่ผูกกับ station นี้จะถูกลบด้วย
            คุณแน่ใจหรือไม่?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>ยืนยันลบ</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
