'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BoardData } from '@/db/queries/queue'
import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { BoardHeader } from './board-header'
import { ServingHero } from './serving-hero'
import { UpNextList } from './up-next-list'
import { AddQueuePanel } from './add-queue-panel'
import {
  addQueueAction,
  nextQueueAction,
  requeueEntryAction,
  resetCounterAction,
  skipEntryAction,
  toggleOpenAction,
} from '../actions'

export function QueueBoard({
  board,
  token,
  liffUrl,
  shareUrl,
  displayUrl,
}: {
  board: BoardData
  token: string
  liffUrl: string
  shareUrl: string
  displayUrl: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // auto-refresh ทุก 7 วิ เพื่อเห็นคิวที่ขอเข้ามาใหม่
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 7000)
    return () => clearInterval(t)
  }, [router])

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn()
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-6">
      <BoardHeader
        board={board}
        isPending={isPending}
        liffUrl={liffUrl}
        shareUrl={shareUrl}
        displayUrl={displayUrl}
        onToggleOpen={() =>
          run(() => toggleOpenAction(token, !board.counter.isOpen))
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ServingHero
          serving={board.serving}
          isPending={isPending}
          onNext={() => run(() => nextQueueAction(token))}
          onSkip={(id) => run(() => skipEntryAction(token, id))}
        />
        <div className="space-y-5">
          <UpNextList
            upcoming={board.upcoming}
            waiting={board.waiting}
            serving={board.serving}
            skipped={board.skipped}
            isPending={isPending}
            onSkip={(id) => run(() => skipEntryAction(token, id))}
            onRequeue={(id) => run(() => requeueEntryAction(token, id))}
          />
          <AddQueuePanel
            isPending={isPending}
            onAdd={async (input) => {
              const r = await addQueueAction(token, input)
              router.refresh()
              return r
            }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <ConfirmActionButton
          triggerLabel="รีเซ็ตคิว"
          pendingLabel="กำลังรีเซ็ต..."
          title="ยืนยันการรีเซ็ตคิว"
          description="คิวที่ค้างอยู่ทั้งหมดจะถูกล้าง และเริ่มนับเลขใหม่จาก 1 — การกระทำนี้ย้อนกลับไม่ได้"
          actionLabel="ยืนยันรีเซ็ต"
          triggerVariant="destructive"
          onConfirm={async () => {
            const r = await resetCounterAction(token)
            router.refresh()
            if (!r.ok) return { message: r.message }
          }}
        />
      </div>
    </div>
  )
}
