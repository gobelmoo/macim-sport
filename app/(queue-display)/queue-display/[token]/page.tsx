import { notFound } from 'next/navigation'
import { getQueueDisplay } from '@/db/queries/queue'
import { signQueueToken, verifyQueueToken } from '@/lib/queue-token'
import { LIFF_BASE } from '@/lib/app-url'
import { DisplayView } from './_components/display-view'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function QueueDisplayPage({ params }: Props) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'display')
  if (!payload) notFound()

  const initial = await getQueueDisplay(payload.counterId)
  if (!initial) notFound()

  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'request',
  })}`

  return <DisplayView token={token} initial={initial} liffUrl={liffUrl} />
}
