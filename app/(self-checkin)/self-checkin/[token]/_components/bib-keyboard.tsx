'use client'

import { Button } from '@/components/ui/button'

interface BibKeyboardProps {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onBack: () => void
}

const DIGIT_ROWS = [
  ['1', '2', '3', '4', '5', '6'],
  ['7', '8', '9', '0', '-', '⌫'],
]
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function BibKeyboard({ value, onChange, onConfirm, onBack }: BibKeyboardProps) {
  function press(char: string) {
    if (value.length >= 12) return
    onChange(value + char)
  }

  function backspace() {
    onChange(value.slice(0, -1))
  }

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

      {/* Digit + hyphen + backspace rows */}
      {DIGIT_ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-6 gap-2">
          {row.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              onClick={key === '⌫' ? backspace : () => press(key)}
              className="h-14 rounded-xl text-2xl font-semibold active:bg-muted select-none"
            >
              {key}
            </Button>
          ))}
        </div>
      ))}

      {/* Letter pad A–Z */}
      <div className="flex flex-wrap justify-center gap-2">
        {LETTERS.map((l) => (
          <Button
            key={l}
            type="button"
            variant="outline"
            onClick={() => press(l)}
            className="h-12 w-12 rounded-xl p-0 text-lg font-semibold active:bg-muted select-none"
          >
            {l}
          </Button>
        ))}
      </div>

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
