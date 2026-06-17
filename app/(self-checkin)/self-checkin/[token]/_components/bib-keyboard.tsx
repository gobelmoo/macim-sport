'use client'

import { Button } from '@/components/ui/button'
import { BibKeypad } from '@/app/_components/bib-keypad'

interface BibKeyboardProps {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onBack: () => void
}

export function BibKeyboard({ value, onChange, onConfirm, onBack }: BibKeyboardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Display bar */}
      <div className="flex h-16 items-center justify-center rounded-xl border-2 bg-background px-4">
        {value ? (
          <span className="font-mono text-4xl font-bold tracking-wider">
            {value}<span className="animate-pulse">|</span>
          </span>
        ) : (
          <span className="text-2xl text-muted-foreground">กรอก BIB</span>
        )}
      </div>

      <BibKeypad value={value} onChange={onChange} />

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button variant="outline" className="h-14 text-base" onClick={onBack}>
          ← กลับสแกน
        </Button>
        <Button
          className="h-14 text-lg"
          disabled={value.length === 0}
          onClick={onConfirm}
        >
          ✓ ยืนยัน
        </Button>
      </div>
    </div>
  )
}
