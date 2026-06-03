'use client'

import { useState, useTransition } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { performCheckin } from '../actions'
import type { CheckinResult } from '../types'

const BIB_INPUT_ID = 'bib-input'

interface Props {
  stationId: string
  eventId: string
}

type UIState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; result: CheckinResult; bib: string }

export function CheckinTerminal({ stationId, eventId }: Props) {
  const [uiState, setUiState] = useState<UIState>({ status: 'idle' })
  const [bib, setBib] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setBib('')
    setUiState({ status: 'idle' })
    // Re-focus via DOM lookup — Input component does not forward refs
    setTimeout(
      () =>
        (document.getElementById(BIB_INPUT_ID) as HTMLInputElement | null)?.focus(),
      80,
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = bib.trim()
    if (!trimmed) return

    setUiState({ status: 'loading' })

    startTransition(async () => {
      const result = await performCheckin({
        bibNumber: trimmed,
        stationId,
        eventId,
      })
      setUiState({ status: 'result', result, bib: trimmed })
    })
  }

  const isLoading = isPending || uiState.status === 'loading'

  return (
    <div className="w-full max-w-lg">
      {/* BIB input form — always visible */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label
          htmlFor={BIB_INPUT_ID}
          className="text-center text-2xl font-semibold text-muted-foreground"
        >
          กรอกหมายเลข BIB
        </label>
        <Input
          id={BIB_INPUT_ID}
          autoFocus
          value={bib}
          onChange={(e) => setBib(e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 1234"
          disabled={isLoading}
          className="h-20 text-center font-mono text-4xl"
        />
        <Button
          type="submit"
          size="lg"
          disabled={isLoading || !bib.trim()}
          className="h-16 w-full text-xl"
        >
          {isLoading ? 'กำลังค้นหา...' : 'ค้นหา'}
        </Button>
      </form>

      {/* Result card */}
      {uiState.status === 'result' && (
        <div className="mt-8">
          <ResultCard result={uiState.result} bib={uiState.bib} onReset={reset} />
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Result card — pure presentational
// ──────────────────────────────────────────────

function ResultCard({
  result,
  bib,
  onReset,
}: {
  result: CheckinResult
  bib: string
  onReset: () => void
}) {
  if (!result.found) {
    return (
      <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-8">
        <p className="text-3xl font-bold text-destructive">ไม่พบข้อมูล</p>
        <p className="mt-2 text-xl text-muted-foreground">BIB: {bib}</p>
        <p className="mt-3 text-xl text-foreground">
          อนุญาตให้เข้าใช้บริการได้
        </p>
        {result.error && (
          <p className="mt-3 text-base text-muted-foreground">{result.error}</p>
        )}
        <ResetButton onReset={onReset} />
      </div>
    )
  }

  const { athlete, isDuplicate } = result
  const initials = `${athlete.firstName[0] ?? ''}${athlete.lastName[0] ?? ''}`.toUpperCase()

  if (isDuplicate) {
    return (
      <div className="rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-8">
        <div className="flex items-center gap-6">
          <AthleteAvatar
            src={athlete.profileImageUrl}
            initials={initials}
          />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-4xl font-bold">
              {athlete.firstName} {athlete.lastName}
            </p>
            <p className="mt-1 font-mono text-2xl text-muted-foreground">
              BIB: {bib}
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-amber-500/20 px-6 py-4">
          <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">
            เคยใช้บริการแล้ว
          </p>
          <p className="mt-1 text-xl text-amber-600 dark:text-amber-300">
            เข้าได้ปกติ — ไม่ได้รับ Stamp เพิ่ม
          </p>
        </div>
        <ResetButton onReset={onReset} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-green-500 bg-green-500/10 p-8">
      <div className="flex items-center gap-6">
        <AthleteAvatar
          src={athlete.profileImageUrl}
          initials={initials}
        />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-4xl font-bold">
            {athlete.firstName} {athlete.lastName}
          </p>
          <p className="mt-1 font-mono text-2xl text-muted-foreground">
            BIB: {bib}
          </p>
        </div>
      </div>
      <div className="mt-6 rounded-xl bg-green-500/20 px-6 py-4">
        <p className="text-2xl font-semibold text-green-700 dark:text-green-400">
          เช็คอินสำเร็จ ✓
        </p>
        <p className="mt-1 text-xl text-green-600 dark:text-green-300">
          ได้รับ Stamp เรียบร้อยแล้ว
        </p>
      </div>
      <ResetButton onReset={onReset} />
    </div>
  )
}

function AthleteAvatar({
  src,
  initials,
}: {
  src: string | null
  initials: string
}) {
  return (
    <Avatar className="h-24 w-24 shrink-0 text-2xl">
      {src && <AvatarImage src={src} alt="athlete photo" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <Button
      size="lg"
      variant="outline"
      className="mt-6 h-16 w-full text-xl"
      onClick={onReset}
    >
      เช็คอินใหม่
    </Button>
  )
}
