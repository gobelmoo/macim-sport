'use client'

import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { deleteStationAction } from '../actions'

type Props = {
  stationId: string
  eventId: string
  stationName: string
}

export function DeleteStationButton({ stationId, eventId, stationName }: Props) {
  return (
    <ConfirmActionButton
      triggerLabel="ลบ"
      pendingLabel="กำลังลบ..."
      title="ยืนยันการลบ Station"
      description={<>ลบ &ldquo;{stationName}&rdquo; ออกจากระบบถาวร ข้อมูล check-in ที่ผูกกับ station นี้จะถูกลบด้วย คุณแน่ใจหรือไม่?</>}
      actionLabel="ยืนยันลบ"
      onConfirm={() => deleteStationAction(stationId, eventId)}
      triggerVariant="destructive"
    />
  )
}
