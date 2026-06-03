'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { performCheckin } from '../actions'
import { CheckinResultCard } from '@/app/_components/checkin-result-card'
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
      const result = await performCheckin({ bibNumber: trimmed, stationId, eventId })
      setUiState({ status: 'result', result, bib: trimmed })
    })
  }

  const isLoading = isPending || uiState.status === 'loading'

  return (
    <div className="w-full max-w-lg">
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

      {uiState.status === 'result' && (
        <div className="mt-8">
          <CheckinResultCard result={uiState.result} bib={uiState.bib} onReset={reset} />
        </div>
      )}
    </div>
  )
}
