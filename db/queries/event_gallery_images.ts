import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { eventGalleryImages } from '@/db/schema/event_gallery_images'

export type GalleryImageRow = {
  imageId: string
  eventId: string
  imageUrl: string
  caption: string | null
  sortOrder: number
}

export async function listGalleryImages(eventId: string): Promise<GalleryImageRow[]> {
  return db
    .select({
      imageId: eventGalleryImages.imageId,
      eventId: eventGalleryImages.eventId,
      imageUrl: eventGalleryImages.imageUrl,
      caption: eventGalleryImages.caption,
      sortOrder: eventGalleryImages.sortOrder,
    })
    .from(eventGalleryImages)
    .where(eq(eventGalleryImages.eventId, eventId))
    .orderBy(asc(eventGalleryImages.sortOrder))
}

export async function addGalleryImage(data: {
  eventId: string
  imageUrl: string
  caption?: string
}): Promise<{ imageId: string }> {
  const existing = await listGalleryImages(data.eventId)
  const sortOrder = existing.length > 0
    ? Math.max(...existing.map((i) => i.sortOrder)) + 1
    : 0

  const [row] = await db
    .insert(eventGalleryImages)
    .values({ ...data, sortOrder })
    .returning({ imageId: eventGalleryImages.imageId })

  return row
}

export async function deleteGalleryImage(imageId: string): Promise<boolean> {
  const [row] = await db
    .delete(eventGalleryImages)
    .where(eq(eventGalleryImages.imageId, imageId))
    .returning({ imageId: eventGalleryImages.imageId })

  return !!row
}

export async function updateGalleryCaption(
  imageId: string,
  caption: string | null,
): Promise<void> {
  await db
    .update(eventGalleryImages)
    .set({ caption })
    .where(eq(eventGalleryImages.imageId, imageId))
}

export async function reorderGalleryImages(orderedImageIds: string[]): Promise<void> {
  await Promise.all(
    orderedImageIds.map((imageId, index) =>
      db
        .update(eventGalleryImages)
        .set({ sortOrder: index })
        .where(eq(eventGalleryImages.imageId, imageId)),
    ),
  )
}
