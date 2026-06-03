import { count, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { sponsors } from '@/db/schema/sponsors'
import { events } from '@/db/schema/events'
import type { serviceTypeEnum } from '@/db/schema/sponsors'

export type SponsorRow = typeof sponsors.$inferSelect

export type CreateSponsorData = {
  sponsorName: string
  companyRegNumber: string
  isInternal: boolean
  serviceType: (typeof serviceTypeEnum.enumValues)[number]
  contactName: string
  contactEmail: string
  logoUrl?: string | null
  brandColor?: string | null
}

export type UpdateSponsorData = Partial<CreateSponsorData>

export async function listSponsors(): Promise<SponsorRow[]> {
  return db
    .select()
    .from(sponsors)
    .where(eq(sponsors.status, 'active'))
    .orderBy(desc(sponsors.createdAt))
}

export async function getSponsor(sponsorId: string): Promise<SponsorRow | null> {
  const [row] = await db
    .select()
    .from(sponsors)
    .where(eq(sponsors.sponsorId, sponsorId))
    .limit(1)

  return row ?? null
}

export async function createSponsor(
  data: CreateSponsorData,
): Promise<{ sponsorId: string }> {
  const [row] = await db
    .insert(sponsors)
    .values(data)
    .returning({ sponsorId: sponsors.sponsorId })

  return row
}

export async function updateSponsor(
  sponsorId: string,
  data: UpdateSponsorData,
): Promise<{ sponsorId: string }> {
  const [row] = await db
    .update(sponsors)
    .set(data)
    .where(eq(sponsors.sponsorId, sponsorId))
    .returning({ sponsorId: sponsors.sponsorId })

  return row
}

export async function isSponsorLinkedToEvents(sponsorId: string): Promise<boolean> {
  const [row] = await db
    .select({ total: count() })
    .from(events)
    .where(eq(events.sponsorId, sponsorId))
    .limit(1)

  return (row?.total ?? 0) > 0
}

export async function deleteSponsor(sponsorId: string): Promise<void> {
  await db.delete(sponsors).where(eq(sponsors.sponsorId, sponsorId))
}
