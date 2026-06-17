import { notFound } from 'next/navigation'
import { getBoard } from '@/db/queries/queue'
import { signQueueToken, verifyQueueToken } from '@/lib/queue-token'
import { APP_BASE, LIFF_BASE } from '@/lib/app-url'
import { QueueBoard } from './_components/queue-board'

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

  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'request',
  })}`
  const shareUrl = `${APP_BASE}/station-queue/${token}`

  return (
    <QueueBoard board={board} token={token} liffUrl={liffUrl} shareUrl={shareUrl} />
  )
}
