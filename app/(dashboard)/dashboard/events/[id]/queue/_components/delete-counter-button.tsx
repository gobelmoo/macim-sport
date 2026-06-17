'use client'

import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { deleteCounterAction } from '../actions'

interface Props {
  eventId: string
  counterId: string
  counterName: string
}

export function DeleteCounterButton({ eventId, counterId, counterName }: Props) {
  return (
    <ConfirmActionButton
      triggerLabel="ลบ"
      pendingLabel="กำลังลบ..."
      title="ยืนยันการลบจุดบริการ"
      description={
        <>
          ลบ <strong>{counterName}</strong> และคิวทั้งหมดของจุดนี้?
        </>
      }
      actionLabel="ยืนยันลบ"
      triggerVariant="destructive"
      onConfirm={() => deleteCounterAction(eventId, counterId)}
    />
  )
}
