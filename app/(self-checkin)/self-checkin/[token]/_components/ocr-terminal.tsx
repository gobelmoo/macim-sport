'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { performSelfCheckin } from '../actions'
import { CheckinResultCard } from '@/app/_components/checkin-result-card'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'

interface Props {
  token: string
  eventName: string
  stationName: string
}

type UIState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'confirming'; bib: string }
  | { status: 'submitting'; bib: string }
  | { status: 'result'; result: CheckinResult; bib: string }
  | { status: 'error'; message: string }

export function OcrTerminal({ token, eventName, stationName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<import('tesseract.js').Worker | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [uiState, setUiState] = useState<UIState>({ status: 'idle' })

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (videoRef.current?.srcObject) {
      ;(videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  // Create Tesseract worker once on first startCamera and keep it alive
  const ensureWorker = useCallback(async () => {
    if (workerRef.current) return
    const { createWorker } = await import('tesseract.js')
    workerRef.current = await createWorker('eng', 1, { logger: () => {} })
    await workerRef.current.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '7' as never, // single line
    })
  }, [])

  const startCamera = useCallback(async () => {
    setUiState({ status: 'scanning' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })

      // Guard: if ref unmounted between await and here, release stream immediately
      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      videoRef.current.srcObject = stream
      await videoRef.current.play()

      await ensureWorker()

      // Scan loop every 600ms
      intervalRef.current = setInterval(async () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        const worker = workerRef.current
        if (!video || !canvas || !worker) return
        if (video.readyState < 2) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const w = video.videoWidth
        const h = video.videoHeight
        const cropH = Math.floor(h * 0.3)
        const cropY = Math.floor(h * 0.35)

        // Only reset canvas dimensions when they actually change
        if (canvas.width !== w || canvas.height !== cropH) {
          canvas.width = w
          canvas.height = cropH
        }
        ctx.drawImage(video, 0, cropY, w, cropH, 0, 0, w, cropH)

        const { data } = await worker.recognize(canvas)
        const raw = data.text.replace(/\D/g, '').trim()

        if (raw.length >= 1 && raw.length <= 5 && data.confidence > 70) {
          stopCamera()
          setUiState({ status: 'confirming', bib: raw })
        }
      }, 600)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องได้'
      setUiState({ status: 'error', message: msg })
    }
  }, [stopCamera, ensureWorker])

  // Terminate worker only on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [stopCamera])

  async function handleConfirm(bib: string) {
    setUiState({ status: 'submitting', bib })
    const result = await performSelfCheckin({ token, bibNumber: bib })
    setUiState({ status: 'result', result, bib })
  }

  function reset() {
    setUiState({ status: 'idle' })
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-8">
      <div className="mb-8 text-center">
        <p className="text-muted-foreground">{eventName}</p>
        <h1 className="text-2xl font-bold">{stationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Self Check-in</p>
      </div>

      <div className="w-full max-w-sm">
        {uiState.status === 'idle' && (
          <div className="flex flex-col items-center gap-6">
            <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-10 text-center">
              <p className="text-5xl mb-4">📸</p>
              <p className="text-lg font-medium">สแกนหมายเลข BIB</p>
              <p className="mt-1 text-sm text-muted-foreground">
                กดปุ่มด้านล่างเพื่อเปิดกล้องและสแกน BIB ของท่าน
              </p>
            </div>
            <Button size="lg" className="w-full h-14 text-lg" onClick={startCamera}>
              เปิดกล้อง
            </Button>
          </div>
        )}

        {uiState.status === 'scanning' && (
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-[0.35] bg-black/40" />
                <div className="flex-[0.3] border-y-2 border-yellow-400 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-yellow-400 text-sm font-medium bg-black/50 px-2 py-1 rounded">
                      วาง BIB ในกรอบสีเหลือง
                    </p>
                  </div>
                </div>
                <div className="flex-[0.35] bg-black/40" />
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <Button variant="outline" size="lg" className="w-full"
              onClick={() => { stopCamera(); reset() }}>
              ยกเลิก
            </Button>
          </div>
        )}

        {uiState.status === 'confirming' && (
          <div className="flex flex-col gap-6 text-center">
            <div className="rounded-2xl border-2 border-yellow-500 bg-yellow-500/10 p-8">
              <p className="text-lg text-muted-foreground">พบหมายเลข BIB</p>
              <p className="mt-2 font-mono text-6xl font-bold">{uiState.bib}</p>
              <p className="mt-3 text-sm text-muted-foreground">ยืนยันหมายเลขนี้ถูกต้องหรือไม่?</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-14" onClick={startCamera}>สแกนใหม่</Button>
              <Button className="flex-1 h-14 text-lg" onClick={() => handleConfirm(uiState.bib)}>ยืนยัน</Button>
            </div>
          </div>
        )}

        {uiState.status === 'submitting' && (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground animate-pulse">กำลังเช็คอิน...</p>
          </div>
        )}

        {uiState.status === 'result' && (
          <CheckinResultCard result={uiState.result} bib={uiState.bib} onReset={reset} />
        )}

        {uiState.status === 'error' && (
          <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-8 text-center">
            <p className="text-xl font-bold text-destructive">เกิดข้อผิดพลาด</p>
            <p className="mt-2 text-muted-foreground">{uiState.message}</p>
            <Button className="mt-6 w-full" onClick={reset}>ลองอีกครั้ง</Button>
          </div>
        )}
      </div>
    </div>
  )
}
