import { StatusView } from './_components/status-view'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function QueueStatusPage({ params }: Props) {
  const { token } = await params
  return (
    <main className="mx-auto max-w-md">
      <StatusView token={token} />
    </main>
  )
}
