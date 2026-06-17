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
import { getStationQueueLinkAction, type StationQueueLink } from './queue-actions'

type Props = {
  stationId: string
  eventId: string
}

export function ManageQueueButton({ stationId, eventId }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<StationQueueLink | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleOpen() {
    setOpen(true)
    setState(null)
    setState(await getStationQueueLinkAction(eventId, stationId))
  }

  async function copy() {
    if (!state?.ok) return
    try {
      await navigator.clipboard.writeText(state.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ — เงียบไว้
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        จัดการคิว
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>หน้าคุมคิว (Staff)</DialogTitle>
            <DialogDescription>
              เปิดบน iPad/มือถือที่ station ได้โดยไม่ต้องล็อกอิน
            </DialogDescription>
          </DialogHeader>
          {!state && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              กำลังเตรียม...
            </p>
          )}
          {state && !state.ok && (
            <p className="py-8 text-center text-sm text-destructive">
              {state.message}
            </p>
          )}
          {state?.ok && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <QRCodeSVG value={state.url} size={200} level="M" />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground">
                {state.url}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={copy}>
                  {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
                </Button>
                <Button asChild>
                  <a href={state.url} target="_blank" rel="noopener noreferrer">
                    เปิดหน้าคุมคิว
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
