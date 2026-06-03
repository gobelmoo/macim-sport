'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  stationName: string
  selfCheckinUrl: string
}

export function StationQrButton({ stationName, selfCheckinUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(selfCheckinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        QR Code
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{stationName}</DialogTitle>
            <DialogDescription>นักกีฬาสแกน QR เพื่อ Self Check-in</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-2">
            <QRCodeSVG value={selfCheckinUrl} size={220} level="M" />
          </div>

          <p className="break-all text-center text-xs text-muted-foreground">
            {selfCheckinUrl}
          </p>

          <Button variant="outline" className="w-full" onClick={handleCopy}>
            {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
