'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { QueueDisplay } from '@/db/queries/queue'

export function DisplayView({
  token,
  initial,
  liffUrl,
}: {
  token: string
  initial: QueueDisplay
  liffUrl: string
}) {
  const [data, setData] = useState<QueueDisplay>(initial)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/queue/display/${token}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const json = await res.json()
        if (active && json.found) setData(json as QueueDisplay)
      } catch {
        // network ชั่วคราว — รอรอบถัดไป
      }
    }
    const t = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [token])

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold lg:text-4xl">{data.counterName}</h1>
        <span
          className={`rounded-full px-4 py-1.5 text-base font-medium ${
            data.isOpen
              ? 'bg-green-100 text-green-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {data.isOpen ? 'เปิดรับคิว' : 'ปิดรับคิว'}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 sm:flex-row">
        <div className="text-center">
          <p className="text-xl text-muted-foreground lg:text-2xl">กำลังเรียกคิว</p>
          {data.serving ? (
            <>
              <p className="text-[8rem] font-bold leading-none text-primary lg:text-[13rem]">
                {data.serving.displayNumber}
              </p>
              {data.serving.bibNumber && (
                <p className="text-2xl text-muted-foreground">
                  BIB {data.serving.bibNumber}
                </p>
              )}
            </>
          ) : (
            <p className="text-[6rem] font-bold leading-none text-muted-foreground lg:text-[10rem]">
              —
            </p>
          )}
        </div>
        <div className="text-center">
          <div className="rounded-2xl border bg-card p-4">
            <QRCodeSVG value={liffUrl} size={160} level="M" />
          </div>
          <p className="mt-2 text-lg font-medium">สแกนรับคิว</p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xl font-medium lg:text-2xl">คิวถัดไป</p>
        {data.next.length === 0 ? (
          <p className="text-lg text-muted-foreground">ไม่มีคิวถัดไป</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.next.map((e) => (
              <div
                key={e.displayNumber}
                className="flex min-w-[5rem] flex-col items-center rounded-2xl border bg-card px-4 py-3"
              >
                <span className="text-3xl font-bold lg:text-4xl">
                  {e.displayNumber}
                </span>
                {e.bibNumber && (
                  <span className="text-xs text-muted-foreground">
                    BIB {e.bibNumber}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
