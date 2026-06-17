import { NextResponse } from 'next/server'
import { getQueueStatus } from '@/db/queries/queue'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const status = await getQueueStatus(token)
  if (!status) return NextResponse.json({ found: false }, { status: 404 })
  return NextResponse.json({ found: true, ...status })
}
