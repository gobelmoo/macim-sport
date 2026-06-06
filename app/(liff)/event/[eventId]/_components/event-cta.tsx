'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { checkRegistrationAction } from '../actions'

type Props = {
  eventId: string
  eventStatus: 'published' | 'active' | 'closed'
  liffId: string
  liffBase: string
}

type CtaState =
  | { phase: 'loading' }
  | { phase: 'coming_soon' }
  | { phase: 'register'; liffUrl: string }
  | { phase: 'registered'; bibNumber: string; manageUrl: string }
  | { phase: 'closed' }

export function EventCta({ eventId, eventStatus, liffId, liffBase }: Props) {
  const [state, setState] = useState<CtaState>({ phase: 'loading' })

  useEffect(() => {
    if (eventStatus === 'published') {
      setState({ phase: 'coming_soon' })
      return
    }
    if (eventStatus === 'closed') {
      setState({ phase: 'closed' })
      return
    }

    // status === 'active'
    const liffUrl = `${liffBase}?eventId=${encodeURIComponent(eventId)}`

    liff
      .init({ liffId })
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
            manageUrl: `${liffBase}?eventId=${encodeURIComponent(eventId)}&bib=${encodeURIComponent(result.bibNumber)}`,
          })
        } else {
          setState({ phase: 'register', liffUrl })
        }
      })
      .catch(() => {
        setState({ phase: 'register', liffUrl })
      })
  }, [eventId, eventStatus, liffId, liffBase])

  if (state.phase === 'loading') {
    return <div className="h-12 animate-pulse rounded-lg bg-muted" />
  }

  if (state.phase === 'coming_soon') {
    return (
      <div className="flex w-full items-center justify-center rounded-lg border border-muted-foreground/30 bg-muted px-4 py-3 text-base font-semibold text-muted-foreground">
        🔜 เร็วๆนี้
      </div>
    )
  }

  if (state.phase === 'closed') {
    return (
      <div className="flex w-full items-center justify-center rounded-lg border bg-muted px-4 py-3 text-base font-semibold text-muted-foreground">
        ปิดรับสมัครแล้ว
      </div>
    )
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

  // phase === 'register'
  return (
    <a
      href={state.liffUrl}
      className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
    >
      ลงทะเบียนรับสิทธิ์ฟรี
    </a>
  )
}
