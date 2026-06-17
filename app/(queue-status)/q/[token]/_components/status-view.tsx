'use client'

import { useEffect, useState } from 'react'
import type { QueueStatus } from '@/db/queries/queue'

type Payload = ({ found: true } & QueueStatus) | { found: false }

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'ใกล้ถึงคิวคุณแล้ว'
  const mins = Math.round(seconds / 60)
  if (mins < 1) return 'น้อยกว่า 1 นาที'
  return `ประมาณ ${mins} นาที`
}

export function StatusView({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/queue/status/${token}`, {
          cache: 'no-store',
        })
        const json: Payload = res.ok ? await res.json() : { found: false }
        if (active) setData(json)
      } catch {
        // network error ชั่วคราว — รอรอบถัดไป
      }
    }
    poll()
    const t = setInterval(poll, 7000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [token])

  if (!data) {
    return <p className="p-6 text-center text-muted-foreground">กำลังโหลด...</p>
  }
  if (!data.found) {
    return <p className="p-6 text-center text-muted-foreground">ไม่พบคิวนี้</p>
  }
  if (!data.sessionValid) {
    return (
      <p className="p-6 text-center text-muted-foreground">
        คิวถูกรีเซ็ตแล้ว กรุณาขอคิวใหม่
      </p>
    )
  }

  const statusText: Record<QueueStatus['entryStatus'], string> = {
    waiting: 'กำลังรอ',
    serving: 'ถึงคิวคุณแล้ว เชิญที่จุดบริการ',
    done: 'เสร็จสิ้นแล้ว',
    skipped: 'คิวของคุณถูกข้าม กรุณาติดต่อเจ้าหน้าที่',
    cancelled: 'คิวถูกยกเลิก',
  }

  return (
    <div className="space-y-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{data.counterName}</p>
      <p className="text-6xl font-bold text-primary">{data.displayNumber}</p>
      <p className="text-base font-medium">{statusText[data.entryStatus]}</p>
      {data.entryStatus === 'waiting' && (
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">มีคิวรอก่อนหน้าคุณ</p>
          <p className="text-3xl font-bold">{data.peopleAhead} คิว</p>
          <p className="mt-1 text-sm">{formatEta(data.etaSeconds)}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        หน้านี้อัปเดตอัตโนมัติทุก ~7 วินาที
      </p>
    </div>
  )
}
