'use client'

import { Button } from '@/components/ui/button'
import type { BoardData } from '@/db/queries/queue'
import { ShareDialog } from './share-dialog'

export function BoardHeader({
  board,
  isPending,
  liffUrl,
  shareUrl,
  onToggleOpen,
}: {
  board: BoardData
  isPending: boolean
  liffUrl: string
  shareUrl: string
  onToggleOpen: () => void
}) {
  const open = board.counter.isOpen
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{board.counter.counterName}</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
              open ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${open ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            {open ? 'เปิดรับคิว' : 'ปิดรับคิว'}
          </span>
          <span className="text-muted-foreground">
            มีคิวรอ {board.waitingCount} คิว
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant={open ? 'outline' : 'default'}
          disabled={isPending}
          onClick={onToggleOpen}
        >
          {open ? 'หยุดรับคิว' : 'เริ่มรับคิว'}
        </Button>
        <ShareDialog
          counterName={board.counter.counterName}
          liffUrl={liffUrl}
          shareUrl={shareUrl}
        />
      </div>
    </div>
  )
}
