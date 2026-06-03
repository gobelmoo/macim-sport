'use client'

import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { deleteSponsorAction } from '../actions'

interface DeleteSponsorButtonProps {
  sponsorId: string
  sponsorName: string
}

export function DeleteSponsorButton({ sponsorId, sponsorName }: DeleteSponsorButtonProps) {
  return (
    <ConfirmActionButton
      triggerLabel="ลบ Sponsor"
      pendingLabel="กำลังลบ..."
      title="ยืนยันการลบ Sponsor"
      description={
        <>
          คุณแน่ใจว่าต้องการลบ{' '}
          <span className="font-semibold text-foreground">{sponsorName}</span>?{' '}
          การกระทำนี้ไม่สามารถย้อนกลับได้
        </>
      }
      actionLabel="ยืนยันลบ"
      onConfirm={() => deleteSponsorAction(sponsorId)}
      triggerVariant="destructive"
      size="default"
    />
  )
}
