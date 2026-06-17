'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import type { BoardData, EntryView } from '@/db/queries/queue'
import {
  addByBibAction,
  addNonMemberAction,
  nextQueueAction,
  requeueEntryAction,
  resetCounterAction,
  skipEntryAction,
  toggleOpenAction,
} from '../actions'

function entryLabel(e: EntryView): string {
  if (e.isNonMember) return `${e.displayLabel ?? 'ไม่ระบุ'} (ไม่ใช่สมาชิก)`
  const name = e.athleteName ?? ''
  const bib = e.bibNumber ? `#${e.bibNumber}` : ''
  return [name, bib].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ'
}

export function QueueBoard({
  eventId,
  board,
}: {
  eventId: string
  board: BoardData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [bib, setBib] = useState('')
  const [guest, setGuest] = useState('')
  const counterId = board.counter.counterId

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
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{board.counter.counterName}</h1>
          <p className="text-sm text-muted-foreground">
            {board.counter.isOpen ? 'กำลังเปิดรับคิว' : 'ปิดรับคิวอยู่'} · รอทั้งหมด{' '}
            {board.waitingCount} คิว
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={board.counter.isOpen ? 'outline' : 'default'}
            disabled={isPending}
            onClick={() =>
              run(() =>
                toggleOpenAction(eventId, counterId, !board.counter.isOpen),
              )
            }
          >
            {board.counter.isOpen ? 'หยุดรับคิว' : 'เริ่มรับคิว'}
          </Button>
          <ConfirmActionButton
            triggerLabel="รีเซ็ตคิว"
            pendingLabel="กำลังรีเซ็ต..."
            title="ยืนยันการรีเซ็ตคิว"
            description="คิวที่ค้างอยู่ทั้งหมดจะถูกล้าง และเริ่มนับเลขใหม่จาก 1 — การกระทำนี้ย้อนกลับไม่ได้"
            actionLabel="ยืนยันรีเซ็ต"
            triggerVariant="destructive"
            onConfirm={async () => {
              const r = await resetCounterAction(eventId, counterId)
              router.refresh()
              if (!r.ok) return { message: r.message }
            }}
          />
        </div>
      </div>

      {/* คิวที่กำลังเรียก */}
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">กำลังเรียก</p>
        {board.serving ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-4xl font-bold text-primary">
                {board.serving.displayNumber}
              </span>
              <span className="ml-3 text-sm">{entryLabel(board.serving)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    skipEntryAction(eventId, counterId, board.serving!.entryId),
                  )
                }
              >
                ข้าม
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">— ยังไม่มีคิวที่เรียก —</p>
        )}
        <Button
          className="mt-3 w-full"
          disabled={isPending}
          onClick={() => run(() => nextQueueAction(eventId, counterId))}
        >
          เรียกคิวถัดไป →
        </Button>
      </div>

      {/* คิวถัดไป 3 ลำดับ */}
      <div>
        <p className="mb-2 text-sm font-medium">คิวถัดไป</p>
        <ul className="space-y-1">
          {board.upcoming.length === 0 && (
            <li className="text-sm text-muted-foreground">— ไม่มีคิวรอ —</li>
          )}
          {board.upcoming.map((e) => (
            <li
              key={e.entryId}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span>
                <strong className="mr-2">{e.displayNumber}</strong>
                {entryLabel(e)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(() => skipEntryAction(eventId, counterId, e.entryId))
                }
              >
                ข้าม
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* คิวที่ถูกข้าม — แทรกกลับได้ */}
      {board.skipped.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">คิวที่ถูกข้าม</p>
          <ul className="space-y-1">
            {board.skipped.map((e) => (
              <li
                key={e.entryId}
                className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2"
              >
                <span>
                  <strong className="mr-2">{e.displayNumber}</strong>
                  {entryLabel(e)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(() => requeueEntryAction(eventId, counterId, e.entryId))
                  }
                >
                  แทรกเป็นคิวถัดไป
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* เพิ่มคิวด้วยตนเอง */}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-medium">เพิ่มคิวแทนนักกีฬา</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={bib}
            onChange={(e) => setBib(e.target.value)}
            placeholder="BIB (ลงทะเบียนแล้ว)"
            className="sm:max-w-[200px]"
          />
          <Button
            variant="secondary"
            disabled={isPending || !bib.trim()}
            onClick={() =>
              run(async () => {
                const r = await addByBibAction(eventId, counterId, bib)
                if (r.ok) setBib('')
                else alert(r.message)
              })
            }
          >
            เพิ่มด้วย BIB
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            placeholder="ชื่อ/ป้ายกำกับ (ไม่ใช่สมาชิก)"
            className="sm:max-w-[200px]"
          />
          <Button
            variant="secondary"
            disabled={isPending || !guest.trim()}
            onClick={() =>
              run(async () => {
                const r = await addNonMemberAction(eventId, counterId, guest)
                if (r.ok) setGuest('')
                else alert(r.message)
              })
            }
          >
            เพิ่ม (ไม่ใช่สมาชิก)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          หมายเหตุ: คิวที่เพิ่มเองไม่มี LINE จึงไม่ได้รับ flex แจ้งเลขคิว
          กรุณาแจ้งเลขคิวกับนักกีฬาโดยตรง
        </p>
      </div>
    </div>
  )
}
