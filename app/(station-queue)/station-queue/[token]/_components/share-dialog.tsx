'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function QrBlock({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ — เงียบไว้
    }
  }
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex justify-center">
        <QRCodeSVG value={url} size={180} level="M" />
      </div>
      <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
      <Button variant="outline" size="sm" className="w-full" onClick={copy}>
        {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
      </Button>
    </div>
  )
}

export function ShareDialog({
  counterName,
  liffUrl,
  shareUrl,
}: {
  counterName: string
  liffUrl: string
  shareUrl: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        QR
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{counterName}</DialogTitle>
            <DialogDescription>
              QR สำหรับนักกีฬาและอุปกรณ์ staff
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <QrBlock title="QR นักกีฬา (สแกนเพื่อรับคิว)" url={liffUrl} />
            <QrBlock title="หน้าจอนี้ (เปิดบนอุปกรณ์ staff อื่น)" url={shareUrl} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
