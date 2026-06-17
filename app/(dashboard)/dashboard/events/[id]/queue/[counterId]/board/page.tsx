import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getBoard } from '@/db/queries/queue'
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

  return <QueueBoard eventId={eventId} board={board} />
}
