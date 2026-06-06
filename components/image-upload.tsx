'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ImageUploadProps = {
  /** ชื่อ hidden input สำหรับ form submit */
  name?: string
  defaultValue?: string | null
  label?: string
  /** callback เมื่อ upload สำเร็จ (ใช้แทน hidden input สำหรับ gallery) */
  onUpload?: (url: string) => void
}

export function ImageUpload({
  name,
  defaultValue,
  label = 'อัปโหลดรูป',
  onUpload,
}: ImageUploadProps) {
  const [url, setUrl] = useState(defaultValue ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      if (onUpload) {
        onUpload(data.url)
      } else {
        setUrl(data.url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const showPreview = !onUpload && url

  return (
    <div className="space-y-2">
      {name && <input type="hidden" name={name} value={url} />}

      {showPreview ? (
        <div className="relative inline-block">
          <img
            src={url}
            alt="preview"
            className="h-32 w-auto rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => setUrl('')}
            className="absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-destructive p-1 text-white"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          {loading ? 'กำลังอัปโหลด...' : label}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
