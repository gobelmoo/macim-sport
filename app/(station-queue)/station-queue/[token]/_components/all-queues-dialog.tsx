'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'

function Row({ e, accent }: { e: EntryView; accent?: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        accent ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <strong className="w-10 shrink-0 text-lg">{e.displayNumber}</strong>
      <span className="text-sm">{entryLabel(e)}</span>
    </li>
  )
}

export function AllQueuesDialog({
  serving,
  waiting,
  skipped,
}: {
  serving: EntryView | null
  waiting: EntryView[]
  skipped: EntryView[]
}) {
  const [open, setOpen] = useState(false)
  const total = (serving ? 1 : 0) + waiting.length + skipped.length
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        ดูทั้งหมด ({total})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>คิวทั้งหมด ({total})</DialogTitle>
            <DialogDescription>ทุกคิวที่ยัง active</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {serving && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  กำลังเรียก
                </p>
                <ul className="space-y-1.5">
                  <Row e={serving} accent />
                </ul>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                รอเรียก ({waiting.length})
              </p>
              <ul className="space-y-1.5">
                {waiting.length === 0 && (
                  <li className="text-sm text-muted-foreground">— ไม่มี —</li>
                )}
                {waiting.map((e) => (
                  <Row key={e.entryId} e={e} />
                ))}
              </ul>
            </div>
            {skipped.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  ถูกข้าม ({skipped.length})
                </p>
                <ul className="space-y-1.5">
                  {skipped.map((e) => (
                    <Row key={e.entryId} e={e} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
