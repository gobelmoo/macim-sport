'use client'

import { useState, useTransition } from 'react'
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
import { deleteSponsorAction } from '../actions'

interface DeleteSponsorButtonProps {
  sponsorId: string
  sponsorName: string
}

export function DeleteSponsorButton({ sponsorId, sponsorName }: DeleteSponsorButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteSponsorAction(sponsorId)
      if (result?.message) {
        setError(result.message)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isPending}>
            {isPending ? 'กำลังลบ...' : 'ลบ Sponsor'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ Sponsor</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจว่าต้องการลบ <span className="font-semibold text-foreground">{sponsorName}</span>?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
