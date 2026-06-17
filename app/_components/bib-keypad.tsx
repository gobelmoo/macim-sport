'use client'

import { Button } from '@/components/ui/button'

const DIGIT_ROWS = [
  ['1', '2', '3', '4', '5', '6'],
  ['7', '8', '9', '0', '-', '⌫'],
]
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface BibKeypadProps {
  value: string
  onChange: (v: string) => void
  maxLength?: number
}

/**
 * แป้นพิมพ์ BIB บนจอ (ตัวเลข + A-Z + ขีด + ลบ) แบบ controlled.
 * ใช้ร่วมหลายที่: self check-in, รับคิวนักกีฬา, กระดานคุมคิว staff.
 */
export function BibKeypad({ value, onChange, maxLength = 12 }: BibKeypadProps) {
  function press(char: string) {
    if (value.length >= maxLength) return
    onChange(value + char)
  }

  function backspace() {
    onChange(value.slice(0, -1))
  }

  return (
    <div className="flex flex-col gap-2">
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
    </div>
  )
}
