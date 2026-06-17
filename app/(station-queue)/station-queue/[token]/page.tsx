import { notFound } from 'next/navigation'
import { getBoard } from '@/db/queries/queue'
import { signQueueToken, verifyQueueToken } from '@/lib/queue-token'
import { QueueBoard } from '@/app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/_components/queue-board'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function StationQueuePage({ params }: Props) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'operate')
  if (!payload) notFound()

  const board = await getBoard(payload.counterId)
  if (!board || board.counter.eventId !== payload.eventId) notFound()

  // QR ให้นักกีฬา (scope request) แสดงบนหน้า staff ด้วย
  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'request',
  })}`

  return (
    <main className="mx-auto max-w-3xl">
      <QueueBoard
        eventId={payload.eventId}
        board={board}
        liffUrl={liffUrl}
        token={token}
      />
    </main>
  )
}
