# BIB Custom Virtual Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง custom virtual keyboard สำหรับ kiosk BIB entry และเพิ่ม auto-timeout 15s จาก scanning mode

**Architecture:** สร้าง `BibKeyboard` component แยกต่างหาก รับ `value/onChange/onConfirm/onBack` props แล้วแทนที่ `<Input>` ใน manual state ของ `OcrTerminal` ส่วน auto-timeout ใช้ `useEffect` watch `uiState.status === 'scanning'`

**Tech Stack:** React, Tailwind CSS, shadcn/ui Button

---

### Task 1: สร้าง `BibKeyboard` component

**Files:**
- Create: `app/(self-checkin)/self-checkin/[token]/_components/bib-keyboard.tsx`

- [ ] **Step 1: สร้างไฟล์ component**

สร้างไฟล์ `app/(self-checkin)/self-checkin/[token]/_components/bib-keyboard.tsx` ด้วย content ดังนี้:

```tsx
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
            <button
              key={key}
              type="button"
              onClick={key === '⌫' ? backspace : () => press(key)}
              className="flex h-14 items-center justify-center rounded-xl border bg-background text-2xl font-semibold active:bg-muted select-none"
            >
              {key}
            </button>
          ))}
        </div>
      ))}

      {/* Letter pad A-Z */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {LETTERS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => press(l)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-base font-medium active:bg-muted select-none"
          >
            {l}
          </button>
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
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
cd /Users/gobelmo/code/SME-BestFriend/MACIM-SPORT
npx tsc --noEmit 2>&1 | grep -v node_modules
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(self-checkin)/self-checkin/[token]/_components/bib-keyboard.tsx"
git commit -m "feat: add BibKeyboard custom virtual keyboard component"
```

---

### Task 2: อัปเดต `OcrTerminal` — ใช้ `BibKeyboard` + auto-timeout

**Files:**
- Modify: `app/(self-checkin)/self-checkin/[token]/_components/ocr-terminal.tsx`

- [ ] **Step 1: แก้ imports**

เปลี่ยน imports บรรทัด 1–8 จาก:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { performSelfCheckin } from '../actions'
import { CheckinResultCard } from '@/app/_components/checkin-result-card'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'
```

เป็น:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BibKeyboard } from './bib-keyboard'
import { performSelfCheckin } from '../actions'
import { CheckinResultCard } from '@/app/_components/checkin-result-card'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'
```

- [ ] **Step 2: แปลง `openManual` เป็น `useCallback`**

เปลี่ยน:

```tsx
  function openManual() {
    stopCamera()
    setUiState({ status: 'manual', value: '' })
  }
```

เป็น:

```tsx
  const openManual = useCallback(() => {
    stopCamera()
    setUiState({ status: 'manual', value: '' })
  }, [stopCamera])
```

- [ ] **Step 3: เพิ่ม auto-timeout 15s effect**

เพิ่ม `useEffect` นี้ต่อจาก auto-reset countdown effect (บรรทัดหลัง `}, [uiState.status, startCamera])`):

```tsx
  // Auto-open keyboard after 15s of scanning without result
  useEffect(() => {
    if (uiState.status !== 'scanning') return
    const t = setTimeout(openManual, 15_000)
    return () => clearTimeout(t)
  }, [uiState.status, openManual])
```

- [ ] **Step 4: แทนที่ manual UI ด้วย `BibKeyboard`**

เปลี่ยน block `uiState.status === 'manual'` จาก:

```tsx
        {uiState.status === 'manual' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
              <p className="text-lg font-medium mb-4">กรอกหมายเลข BIB</p>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="เช่น 1001"
                className="text-center text-2xl h-14 font-mono"
                value={uiState.value}
                onChange={(e) =>
                  setUiState({ status: 'manual', value: e.target.value.replace(/\D/g, '') })
                }
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-14" onClick={startCamera}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 h-14 text-lg"
                disabled={uiState.value.length < 1}
                onClick={() => handleConfirm(uiState.value)}
              >
                ยืนยัน
              </Button>
            </div>
          </div>
        )}
```

เป็น:

```tsx
        {uiState.status === 'manual' && (
          <BibKeyboard
            value={uiState.value}
            onChange={(v) => setUiState({ status: 'manual', value: v })}
            onConfirm={() => handleConfirm(uiState.value)}
            onBack={startCamera}
          />
        )}
```

- [ ] **Step 5: ตรวจ TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules
```

Expected: ไม่มี error

- [ ] **Step 6: Commit, push, deploy**

```bash
git add "app/(self-checkin)/self-checkin/[token]/_components/ocr-terminal.tsx"
git commit -m "feat: wire BibKeyboard into OcrTerminal with 15s auto-timeout"
git push origin main
vercel --prod
```
