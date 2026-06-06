import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature } from '@/lib/line-client'
import { handlePostback, handleText, startFlow } from '@/lib/line-state'

interface LineEvent {
  type: string
  replyToken?: string
  source: { userId: string }
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

  const payload = JSON.parse(body) as LineWebhookBody

  await Promise.allSettled(
    payload.events.map(async (event) => {
      const lineUserId = event.source.userId
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
        const data = JSON.parse(event.postback.data) as Record<string, string>
        await handlePostback(lineUserId, data, replyToken)
        return
      }
    }),
  )

  return NextResponse.json({ ok: true })
}
