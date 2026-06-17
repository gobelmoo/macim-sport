'use client'

import { useActionState, useEffect, useState } from 'react'
import liff from '@line/liff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getQueueContext, requestQueue, type QueueContext } from '../actions'

export function QueueRequest({ token }: { token: string }) {
  const [idToken, setIdToken] = useState<string | null>(null)
  const [ctx, setCtx] = useState<QueueContext | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(requestQueue, null)

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const t = liff.getIDToken()
        if (!t) {
          setInitError('ไม่พบ ID Token กรุณาเปิดผ่าน LINE ใหม่')
          return
        }
        setIdToken(t)
        setCtx(await getQueueContext(token, t))
      } catch {
        setInitError('เปิด LIFF ไม่สำเร็จ กรุณาลองใหม่')
      }
    }
    init()
  }, [token])

  if (state?.ok) {
    return (
      <div className="space-y-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{state.counterName}</p>
        <p className="text-6xl font-bold text-primary">{state.displayNumber}</p>
        <p className="text-sm">หมายเลขคิวของคุณ</p>
        <a
          className="text-sm text-blue-600 underline"
          href={`/q/${state.statusToken}`}
        >
          ดูสถานะคิว / เวลารอ
        </a>
        <p className="text-xs text-muted-foreground">
          เราได้ส่งเลขคิวให้ทาง LINE แล้ว
        </p>
      </div>
    )
  }

  if (initError) {
    return <p className="p-6 text-center text-destructive">{initError}</p>
  }
  if (!ctx) {
    return <p className="p-6 text-center text-muted-foreground">กำลังโหลด...</p>
  }
  if (!ctx.ok) {
    const msg =
      ctx.reason === 'closed'
        ? 'ขณะนี้ยังไม่เปิด หรือปิดรับคิวแล้ว'
        : 'ลิงก์ไม่ถูกต้อง'
    return <p className="p-6 text-center text-muted-foreground">{msg}</p>
  }

  return (
    <form action={formAction} className="space-y-3 p-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
      <h1 className="text-lg font-bold">รับคิว — {ctx.counterName}</h1>

      {ctx.mode !== 'ready' && (
        <div>
          <label className="text-sm">หมายเลข BIB</label>
          <Input name="bib" required placeholder="เช่น A123" />
        </div>
      )}

      {ctx.mode === 'need_profile' && (
        <>
          <div>
            <label className="text-sm">ชื่อ</label>
            <Input name="firstName" required />
          </div>
          <div>
            <label className="text-sm">นามสกุล</label>
            <Input name="lastName" required />
          </div>
          <div>
            <label className="text-sm">วันเกิด</label>
            <Input name="dateOfBirth" type="date" required />
          </div>
          <div>
            <label className="text-sm">เพศ</label>
            <select
              name="gender"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">เลือก</option>
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
              <option value="lgbtq">LGBTQ+</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        </>
      )}

      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={isPending || !idToken}>
        {isPending ? 'กำลังขอคิว...' : 'ขอเลขคิว'}
      </Button>
    </form>
  )
}
