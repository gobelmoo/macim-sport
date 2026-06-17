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

interface Props {
  counterName: string
  liffUrl: string
  triggerLabel?: string
  description?: string
}

export function QueueQrButton({
  counterName,
  liffUrl,
  triggerLabel = 'QR Code',
  description = 'นักกีฬาสแกน QR เพื่อรับคิว',
}: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(liffUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ — เงียบไว้
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{counterName}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <QRCodeSVG value={liffUrl} size={220} level="M" />
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">
            {liffUrl}
          </p>
          <Button variant="outline" className="w-full" onClick={handleCopy}>
            {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
