'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'

interface Props {
  stationName: string
  selfCheckinUrl: string
}

export function StationQrButton({ stationName, selfCheckinUrl }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        QR Code
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-center text-lg font-semibold">{stationName}</h2>
            <p className="mb-5 text-center text-sm text-muted-foreground">
              นักกีฬาสแกน QR เพื่อ Self Check-in
            </p>

            <div className="flex justify-center">
              <QRCodeSVG value={selfCheckinUrl} size={220} level="M" />
            </div>

            <p className="mt-4 break-all text-center text-xs text-muted-foreground">
              {selfCheckinUrl}
            </p>

            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(selfCheckinUrl)
                }}
              >
                คัดลอก URL
              </Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>
                ปิด
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
