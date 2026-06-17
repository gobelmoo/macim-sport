'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getOrCreateCounterForStation } from '@/db/queries/queue'

export async function openStationQueueAction(eventId: string, stationId: string) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if (!canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) redirect('/dashboard')

  // auto-create counter ของ station ถ้ายังไม่มี แล้วเข้า board
  const counterId = await getOrCreateCounterForStation(stationId)
  if (!counterId) redirect(`/dashboard/events/${eventId}`)
  redirect(`/dashboard/events/${eventId}/queue/${counterId}/board`)
}
