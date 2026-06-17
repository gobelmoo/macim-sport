import { QueueRequest } from './_components/queue-request'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function QueueLiffPage({ params }: Props) {
  const { token } = await params
  return <QueueRequest token={token} />
}
