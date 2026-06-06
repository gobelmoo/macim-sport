'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { checkRegistrationAction } from '../actions'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID!
const LIFF_BASE = `https://liff.line.me/${LIFF_ID}`

type Props = {
  eventId: string
  eventStatus: string
}

type CtaState =
  | { phase: 'loading' }
  | { phase: 'register'; liffUrl: string }
  | { phase: 'registered'; bibNumber: string; manageUrl: string }

export function EventCta({ eventId, eventStatus }: Props) {
  const [state, setState] = useState<CtaState>({ phase: 'loading' })

  useEffect(() => {
    if (eventStatus !== 'active') return

    const liffUrl = `${LIFF_BASE}?eventId=${encodeURIComponent(eventId)}`

    liff
      .init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          setState({ phase: 'register', liffUrl })
          return
        }
        const idToken = liff.getIDToken()
        if (!idToken) {
          setState({ phase: 'register', liffUrl })
          return
        }
        const result = await checkRegistrationAction(idToken, eventId)
        if (result.registered && result.bibNumber) {
          setState({
            phase: 'registered',
            bibNumber: result.bibNumber,
            manageUrl: `${liffUrl}&bib=${encodeURIComponent(result.bibNumber)}`,
          })
        } else {
          setState({ phase: 'register', liffUrl })
        }
      })
      .catch(() => {
        setState({ phase: 'register', liffUrl })
      })
  }, [eventId, eventStatus])

  if (eventStatus === 'published') {
    return (
      <div className="flex w-full items-center justify-center rounded-lg border border-muted-foreground/30 bg-muted px-4 py-3 text-base font-semibold text-muted-foreground">
        🔜 เร็วๆนี้
      </div>
    )
  }

  if (eventStatus !== 'active') {
    return (
      <div className="flex w-full items-center justify-center rounded-lg border bg-muted px-4 py-3 text-base font-semibold text-muted-foreground">
        ปิดรับสมัครแล้ว
      </div>
    )
  }

  if (state.phase === 'loading') {
    return <div className="h-12 animate-pulse rounded-lg bg-muted" />
  }

  if (state.phase === 'registered') {
    return (
      <div className="space-y-2">
        <div className="flex w-full items-center justify-center rounded-lg border border-green-500 bg-green-50 px-4 py-3 text-base font-semibold text-green-700">
          ✅ รับสิทธิ์แล้ว (BIB: {state.bibNumber})
        </div>
        <a
          href={state.manageUrl}
          className="flex w-full items-center justify-center rounded-lg border px-4 py-3 text-base font-semibold text-foreground"
        >
          จัดการข้อมูล
        </a>
      </div>
    )
  }

  return (
    <a
      href={state.liffUrl}
      className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
    >
      ลงทะเบียนรับสิทธิ์ฟรี
    </a>
  )
}
