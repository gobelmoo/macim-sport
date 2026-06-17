import { NextResponse } from 'next/server'
import { verifyQueueToken } from '@/lib/queue-token'
import { getQueueDisplay } from '@/db/queries/queue'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'display')
  if (!payload) return NextResponse.json({ found: false }, { status: 404 })
  const data = await getQueueDisplay(payload.counterId)
  if (!data) return NextResponse.json({ found: false }, { status: 404 })
  return NextResponse.json({ found: true, ...data })
}
