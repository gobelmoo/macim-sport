'use client'

import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { deleteEventAction } from './actions'

export function DeleteEventButton({ eventId }: { eventId: string }) {
  return (
    <ConfirmActionButton
      triggerLabel="ลบ Event"
      pendingLabel="กำลังลบ..."
      title="ยืนยันการลบ Event"
      description="การลบ Event จะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่ว่าต้องการลบ Event นี้?"
      actionLabel="ยืนยันลบ"
      onConfirm={() => deleteEventAction(eventId)}
      triggerVariant="destructive"
    />
  )
}
