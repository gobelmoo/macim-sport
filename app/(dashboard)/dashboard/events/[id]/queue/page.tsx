import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { listCountersByEvent } from '@/db/queries/queue'
import { signQueueToken } from '@/lib/queue-token'
import { CounterCreateForm } from './_components/counter-create-form'
import { QueueQrButton } from './_components/queue-qr-button'
import { DeleteCounterButton } from './_components/delete-counter-button'

export const dynamic = 'force-dynamic'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

interface Props {
  params: Promise<{ id: string }>
}

export default async function QueuePage({ params }: Props) {
  const { id: eventId } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if (!canAccess(PERMISSIONS.QUEUE_MANAGE, session.user)) notFound()

  const counters = await listCountersByEvent(eventId)
  const withTokens = await Promise.all(
    counters.map(async (c) => ({
      ...c,
      liffUrl: `${LIFF_BASE}/queue/${await signQueueToken({
        counterId: c.counterId,
        eventId,
      })}`,
    })),
  )

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-bold">จัดการคิว</h1>
        <p className="text-sm text-muted-foreground">
          แต่ละจุดบริการมีลำดับเลขคิวแยกกัน
        </p>
      </div>

      <CounterCreateForm eventId={eventId} />

      <ul className="space-y-2">
        {withTokens.length === 0 && (
          <li className="text-sm text-muted-foreground">ยังไม่มีจุดบริการคิว</li>
        )}
        {withTokens.map((c) => (
          <li
            key={c.counterId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{c.counterName}</p>
              <p className="text-xs text-muted-foreground">
                {c.isOpen ? 'เปิดรับคิว' : 'ปิดรับคิว'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <QueueQrButton counterName={c.counterName} liffUrl={c.liffUrl} />
              <Button asChild size="sm">
                <Link
                  href={`/dashboard/events/${eventId}/queue/${c.counterId}/board`}
                >
                  กระดานคิว
                </Link>
              </Button>
              <DeleteCounterButton
                eventId={eventId}
                counterId={c.counterId}
                counterName={c.counterName}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
