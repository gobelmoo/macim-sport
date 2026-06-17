'use server'

import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getOrCreateCounterForStation } from '@/db/queries/queue'
import { signQueueToken } from '@/lib/queue-token'
import { APP_BASE } from '@/lib/app-url'

export type StationQueueLink =
  | { ok: true; url: string }
  | { ok: false; message: string }

/** auth → get/create counter ของ station → คืนลิงก์หน้าคุมคิว staff (operate token) */
export async function getStationQueueLinkAction(
  eventId: string,
  stationId: string,
): Promise<StationQueueLink> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: 'ไม่ได้รับอนุญาต' }
  if (!canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) {
    return { ok: false, message: 'ไม่มีสิทธิ์จัดการคิว' }
  }
  const counterId = await getOrCreateCounterForStation(stationId)
  if (!counterId) return { ok: false, message: 'ไม่พบ station' }
  const token = await signQueueToken({ counterId, eventId, scope: 'operate' })
  return { ok: true, url: `${APP_BASE}/station-queue/${token}` }
}
