'use client'

import { useState, useTransition } from 'react'
import { X, GripVertical } from 'lucide-react'
import { ImageUpload } from '@/components/image-upload'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  addGalleryImageAction,
  deleteGalleryImageAction,
  updateGalleryCaptionAction,
  reorderGalleryAction,
} from '../actions'
import type { GalleryImageRow } from '@/db/queries/event_gallery_images'

type GallerySectionProps = {
  eventId: string
  initialImages: GalleryImageRow[]
}

export function GallerySection({ eventId, initialImages }: GallerySectionProps) {
  const [images, setImages] = useState<GalleryImageRow[]>(initialImages)
  const [isPending, startTransition] = useTransition()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')

  async function handleAddImage(url: string) {
    setUploadError('')
    const result = await addGalleryImageAction(eventId, url, null)
    if ('imageId' in result) {
      setImages((prev) => [
        ...prev,
        {
          imageId: result.imageId,
          eventId,
          imageUrl: url,
          caption: null,
          sortOrder: prev.length,
        },
      ])
    } else {
      setUploadError(result.error)
    }
  }

  function handleDelete(imageId: string) {
    startTransition(async () => {
      await deleteGalleryImageAction(imageId, eventId)
      setImages((prev) => prev.filter((i) => i.imageId !== imageId))
    })
  }

  function handleCaptionBlur(imageId: string, caption: string) {
    const value = caption.trim() || null
    startTransition(async () => {
      await updateGalleryCaptionAction(imageId, eventId, value)
    })
    setImages((prev) =>
      prev.map((i) => (i.imageId === imageId ? { ...i, caption: value } : i)),
    )
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const reordered = [...images]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setImages(reordered)
    setDragIndex(null)
    startTransition(async () => {
      await reorderGalleryAction(eventId, reordered.map((i) => i.imageId))
    })
  }

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div
              key={image.imageId}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className="group relative space-y-2 rounded-lg border p-2"
            >
              <div className="relative">
                <img
                  src={image.imageUrl}
                  alt=""
                  className="h-32 w-full rounded object-cover"
                />
                <div className="absolute left-2 top-2 cursor-grab text-white opacity-0 group-hover:opacity-100">
                  <GripVertical className="size-4 drop-shadow" />
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(image.imageId)}
                  className="absolute right-2 top-2 hidden rounded-full bg-destructive p-1 text-white group-hover:flex"
                >
                  <X className="size-3" />
                </button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Caption</Label>
                <Input
                  type="text"
                  defaultValue={image.caption ?? ''}
                  placeholder="Caption (optional)"
                  className="h-7 text-xs"
                  onBlur={(e) => handleCaptionBlur(image.imageId, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <ImageUpload
          label="เพิ่มรูป Gallery"
          onUpload={handleAddImage}
        />
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </div>
    </div>
  )
}
