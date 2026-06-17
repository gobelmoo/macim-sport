import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature } from '@/lib/line-client'
import { handlePostback, handleText, startFlow, shouldAutoReply } from '@/lib/line-state'
import { getLineSettings } from '@/db/queries/line'

interface LineEvent {
  type: string
  replyToken?: string
  source: { userId?: string }
  message?: { type: string; text: string }
  postback?: { data: string }
}

interface LineWebhookBody {
  events: LineEvent[]
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  const valid = await verifyLineSignature(body, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: LineWebhookBody
  try {
    payload = JSON.parse(body) as LineWebhookBody
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!Array.isArray(payload.events)) {
    return NextResponse.json({ ok: true })
  }

  const settings = await getLineSettings()
  if (!shouldAutoReply(settings)) {
    return NextResponse.json({ ok: true })
  }

  const results = await Promise.allSettled(
    payload.events.map(async (event) => {
      const lineUserId = event.source.userId
      if (!lineUserId) return

      const replyToken = event.replyToken ?? ''

      if (event.type === 'follow') {
        await startFlow(lineUserId, replyToken)
        return
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        await handleText(lineUserId, event.message.text.trim(), replyToken)
        return
      }

      if (event.type === 'postback' && event.postback?.data) {
        let data: Record<string, string>
        try {
          data = JSON.parse(event.postback.data) as Record<string, string>
        } catch {
          return
        }
        await handlePostback(lineUserId, data, replyToken)
        return
      }
    }),
  )

  results.forEach((r) => {
    if (r.status === 'rejected') console.error('[webhook] event handler failed', r.reason)
  })

  return NextResponse.json({ ok: true })
}
