const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply'
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

function authHeader() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  }
}

export async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) throw new Error('LINE_CHANNEL_SECRET not set')

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const computed = Buffer.from(signed).toString('base64')
  return computed === signature
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function replyMessage(replyToken: string, messages: any[]): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ replyToken, messages }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[replyMessage] LINE API error', res.status, body)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pushMessage(to: string, messages: any[]): Promise<void> {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[pushMessage] LINE API error', res.status, body)
  }
}

export async function verifyLiffIdToken(idToken: string): Promise<string> {
  // LIFF channel ID is the numeric prefix of the LIFF ID (format: {channelId}-{suffix})
  const liffChannelId = (process.env.NEXT_PUBLIC_LIFF_ID ?? '').split('-')[0]
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: liffChannelId,
    }),
  })
  if (!res.ok) throw new Error('LIFF token verification failed')
  const data = await res.json() as { sub: string }
  return data.sub
}
