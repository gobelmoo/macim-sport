import { notFound } from 'next/navigation'
import { MapPin, Calendar, User } from 'lucide-react'
import { getEventDetail } from '@/db/queries/events'
import { listGalleryImages } from '@/db/queries/event_gallery_images'

type Props = { params: Promise<{ eventId: string }> }

export default async function LiffEventDetailPage({ params }: Props) {
  const { eventId } = await params

  const [event, gallery] = await Promise.all([
    getEventDetail(eventId),
    listGalleryImages(eventId),
  ])

  if (!event || event.status === 'draft' || event.status === 'archived') {
    notFound()
  }

  const liffRegisterUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?eventId=${eventId}`

  return (
    <div className="min-h-screen bg-background">
      {/* Logo */}
      {event.eventLogoUrl ? (
        <img
          src={event.eventLogoUrl}
          alt={event.eventName}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-muted">
          <Calendar className="size-12 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-6 p-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{event.eventName}</h1>

          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 shrink-0" />
              <span>{event.startDate} – {event.endDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" />
              <span>{event.eventLocation}, {event.eventCity}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 shrink-0" />
              <span>{event.organizerName}</span>
            </div>
          </div>

          {event.description && (
            <p className="mt-3 text-sm leading-relaxed">{event.description}</p>
          )}
        </div>

        {/* Long Description */}
        {event.longDescription && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: event.longDescription }}
          />
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Gallery</h2>
            <div className="grid grid-cols-2 gap-2">
              {gallery.map((img) => (
                <div key={img.imageId} className="space-y-1">
                  <img
                    src={img.imageUrl}
                    alt={img.caption ?? ''}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  {img.caption && (
                    <p className="text-center text-xs text-muted-foreground">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-4">
          <a
            href={liffRegisterUrl}
            className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
          >
            ลงทะเบียน
          </a>
        </div>
      </div>
    </div>
  )
}
