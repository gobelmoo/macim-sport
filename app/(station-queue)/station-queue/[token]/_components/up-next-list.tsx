'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'

export function UpNextList({
  upcoming,
  skipped,
  isPending,
  onSkip,
  onRequeue,
}: {
  upcoming: EntryView[]
  skipped: EntryView[]
  isPending: boolean
  onSkip: (id: string) => void
  onRequeue: (id: string) => void
}) {
  const [showSkipped, setShowSkipped] = useState(false)
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="mb-3 text-sm font-medium">คิวถัดไป</p>
      <ul className="space-y-2">
        {upcoming.length === 0 && (
          <li className="text-sm text-muted-foreground">— ไม่มีคิวรอ —</li>
        )}
        {upcoming.map((e) => (
          <li
            key={e.entryId}
            className="flex items-center justify-between rounded-xl border px-3 py-2.5"
          >
            <span className="flex items-center gap-2">
              <strong className="text-lg">{e.displayNumber}</strong>
              {entryLabel(e)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => onSkip(e.entryId)}
            >
              ข้าม
            </Button>
          </li>
        ))}
      </ul>

      {skipped.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground"
            onClick={() => setShowSkipped((v) => !v)}
          >
            {showSkipped ? '▾' : '▸'} คิวที่ถูกข้าม ({skipped.length})
          </button>
          {showSkipped && (
            <ul className="mt-2 space-y-2">
              {skipped.map((e) => (
                <li
                  key={e.entryId}
                  className="flex items-center justify-between rounded-xl border border-dashed px-3 py-2.5"
                >
                  <span className="flex items-center gap-2">
                    <strong className="text-lg">{e.displayNumber}</strong>
                    {entryLabel(e)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onRequeue(e.entryId)}
                  >
                    แทรกเป็นคิวถัดไป
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
