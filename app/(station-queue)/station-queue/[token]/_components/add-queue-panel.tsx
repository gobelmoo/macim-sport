'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BibKeypad } from '@/app/_components/bib-keypad'

type AddResult = { ok: boolean; message?: string }

export function AddQueuePanel({
  isPending,
  onAdd,
}: {
  isPending: boolean
  onAdd: (input: string) => Promise<AddResult>
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const r = await onAdd(input)
      if (r.ok) {
        setInput('')
        setMsg(r.message ?? null)
      } else {
        setMsg(null)
        alert(r.message)
      }
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <button
        type="button"
        className="text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} เพิ่มคิว
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="BIB หรือ ชื่อนักกีฬา"
              className="sm:max-w-[260px]"
            />
            <Button
              variant="secondary"
              disabled={isPending || busy || !input.trim()}
              onClick={submit}
            >
              เพิ่มคิว
            </Button>
          </div>
          <BibKeypad value={input} onChange={setInput} />
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <p className="text-xs text-muted-foreground">
            กรอก BIB ที่ลงทะเบียน → ผูกนักกีฬา · ชื่อหรือ BIB ที่ยังไม่ลงทะเบียน →
            เพิ่มเป็น “ไม่ใช่สมาชิก” (ไม่ได้รับ flex แจ้งเลขคิว)
          </p>
        </div>
      )}
    </div>
  )
}
