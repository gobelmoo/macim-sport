'use client'

import { Button } from '@/components/ui/button'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'

export function ServingHero({
  serving,
  isPending,
  onNext,
  onSkip,
}: {
  serving: EntryView | null
  isPending: boolean
  onNext: () => void
  onSkip: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border bg-primary/5 p-6">
      <p className="text-center text-sm font-medium text-muted-foreground">
        กำลังเรียก
      </p>
      {serving ? (
        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          <span className="text-7xl font-bold leading-none text-primary lg:text-8xl">
            {serving.displayNumber}
          </span>
          <span className="text-lg">{entryLabel(serving)}</span>
        </div>
      ) : (
        <p className="mt-8 text-center text-lg text-muted-foreground">
          — ยังไม่มีคิวที่เรียก —
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="h-14 flex-1 text-base"
          disabled={isPending || !serving}
          onClick={() => serving && onSkip(serving.entryId)}
        >
          ข้ามคิวนี้
        </Button>
        <Button
          className="h-14 flex-[2] text-lg"
          disabled={isPending}
          onClick={onNext}
        >
          เรียกคิวถัดไป →
        </Button>
      </div>
    </div>
  )
}
