import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getBoard } from '@/db/queries/queue'
import { signQueueToken } from '@/lib/queue-token'
import { APP_BASE, LIFF_BASE } from '@/lib/app-url'
import { QueueBoard } from './_components/queue-board'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; counterId: string }>
}

export default async function BoardPage({ params }: Props) {
  const { id: eventId, counterId } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if (!canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) notFound()

  const board = await getBoard(counterId)
  if (!board || board.counter.eventId !== eventId) notFound()

  // QR ให้นักกีฬาสแกนรับคิว (counter ผูก station อยู่แล้ว)
  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({ counterId, eventId, scope: 'request' })}`
  // ลิงก์หน้าคุมคิว staff แบบ standalone (ไม่ต้องล็อกอิน)
  const operatorUrl = `${APP_BASE}/station-queue/${await signQueueToken({ counterId, eventId, scope: 'operate' })}`

  return (
    <QueueBoard
      eventId={eventId}
      board={board}
      liffUrl={liffUrl}
      operatorUrl={operatorUrl}
    />
  )
}
