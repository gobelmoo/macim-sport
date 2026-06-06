'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { performSelfCheckin } from '../actions'
import { CheckinResultCard } from '@/app/_components/checkin-result-card'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'

interface Props {
  token: string
  eventName: string
  stationName: string
}

type UIState =
  | { status: 'scanning' }
  | { status: 'confirming'; bib: string }
  | { status: 'manual'; value: string }
  | { status: 'submitting'; bib: string }
  | { status: 'result'; result: CheckinResult; bib: string }
  | { status: 'error'; message: string }

const AUTO_RESET_SECONDS = 5

export function OcrTerminal({ token, eventName, stationName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<import('tesseract.js').Worker | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isProcessingRef = useRef(false)
  const lastBibRef = useRef<string | null>(null)
  const consecutiveRef = useRef(0)
  const [uiState, setUiState] = useState<UIState>({ status: 'scanning' })
  const [countdown, setCountdown] = useState<number | null>(null)
  const [debug, setDebug] = useState<{ text: string; confidence: number; dim: string } | null>(null)

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current as unknown as ReturnType<typeof setTimeout>)
      intervalRef.current = null
    }
    isProcessingRef.current = false
    if (videoRef.current?.srcObject) {
      ;(videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const ensureWorker = useCallback(async () => {
    if (workerRef.current) return
    const { createWorker } = await import('tesseract.js')
    workerRef.current = await createWorker('eng', 1, { logger: () => {} })
    await workerRef.current.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
      tessedit_pageseg_mode: '7' as never,
    })
  }, [])

  const startCamera = useCallback(async () => {
    setUiState({ status: 'scanning' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 } },
      })

      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      videoRef.current.srcObject = stream
      await videoRef.current.play()

      await ensureWorker()

      lastBibRef.current = null
      consecutiveRef.current = 0

      const runScan = async () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        const worker = workerRef.current
        if (!video || !canvas || !worker) return
        if (video.readyState < 2) { scheduleNext(); return }
        if (isProcessingRef.current) { scheduleNext(); return }

        isProcessingRef.current = true
        try {
          const ctx = canvas.getContext('2d')
          if (!ctx) { scheduleNext(); return }

          const w = video.videoWidth
          const h = video.videoHeight
          const cropH = Math.floor(h * 0.3)
          const cropY = Math.floor(h * 0.35)

          if (canvas.width !== w || canvas.height !== cropH) {
            canvas.width = w
            canvas.height = cropH
          }
          ctx.drawImage(video, 0, cropY, w, cropH, 0, 0, w, cropH)

          const { data } = await worker.recognize(canvas)
          const raw = data.text.replace(/[^A-Z0-9-]/gi, '').trim().toUpperCase()

          setDebug({
            text: raw || '(ไม่พบ)',
            confidence: Math.round(data.confidence),
            dim: `${w}×${h}`,
          })

          if (raw.length >= 2 && raw.length <= 5) {
            if (raw === lastBibRef.current) {
              consecutiveRef.current += 1
            } else {
              lastBibRef.current = raw
              consecutiveRef.current = 1
            }

            if (consecutiveRef.current >= 2) {
              stopCamera()
              setUiState({ status: 'confirming', bib: raw })
              return
            }
          } else {
            lastBibRef.current = null
            consecutiveRef.current = 0
          }
        } finally {
          isProcessingRef.current = false
        }
        scheduleNext()
      }

      const scheduleNext = () => {
        if (intervalRef.current !== null) return
        intervalRef.current = setTimeout(() => {
          intervalRef.current = null
          runScan()
        }, 600) as unknown as ReturnType<typeof setInterval>
      }

      scheduleNext()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องได้'
      setUiState({ status: 'error', message: msg })
    }
  }, [stopCamera, ensureWorker])

  // Auto-start on mount
  useEffect(() => {
    startCamera()
  }, [startCamera])

  // Auto-reset countdown after result
  useEffect(() => {
    if (uiState.status !== 'result') { setCountdown(null); return }
    setCountdown(AUTO_RESET_SECONDS)
    const tick = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null))
    }, 1000)
    const reset = setTimeout(() => startCamera(), AUTO_RESET_SECONDS * 1000)
    return () => { clearInterval(tick); clearTimeout(reset) }
  }, [uiState.status, startCamera])

  // Terminate worker on unmount
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

  function openManual() {
    stopCamera()
    setUiState({ status: 'manual', value: '' })
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-8">
      <div className="mb-6 text-center">
        <p className="text-muted-foreground">{eventName}</p>
        <h1 className="text-2xl font-bold">{stationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Self Check-in</p>
      </div>

      <div className="w-full max-w-sm">
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
            {/* diagnostic panel */}
            <div className="rounded-xl border bg-muted/60 p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground">ภาพที่ OCR เห็น (crop zone)</p>
              <canvas ref={canvasRef} className="w-full rounded border" />
              {debug ? (
                <>
                  <p>กล้อง: <span className="font-mono">{debug.dim}</span></p>
                  <p>อ่านได้: <span className="font-mono font-bold">{debug.text}</span></p>
                  <p>confidence: <span className="font-mono">{debug.confidence}%</span></p>
                </>
              ) : (
                <p className="text-muted-foreground">รอผล OCR...</p>
              )}
            </div>
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-2 text-center py-1"
              onClick={openManual}
            >
              กรอกหมายเลข BIB เอง
            </button>
          </div>
        )}

        {uiState.status === 'manual' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
              <p className="text-lg font-medium mb-4">กรอกหมายเลข BIB</p>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="เช่น 1001"
                className="text-center text-2xl h-14 font-mono"
                value={uiState.value}
                onChange={(e) =>
                  setUiState({ status: 'manual', value: e.target.value.replace(/\D/g, '') })
                }
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-14" onClick={startCamera}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 h-14 text-lg"
                disabled={uiState.value.length < 1}
                onClick={() => handleConfirm(uiState.value)}
              >
                ยืนยัน
              </Button>
            </div>
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
              <Button variant="outline" className="flex-1 h-14" onClick={startCamera}>
                สแกนใหม่
              </Button>
              <Button className="flex-1 h-14 text-lg" onClick={() => handleConfirm(uiState.bib)}>
                ยืนยัน
              </Button>
            </div>
          </div>
        )}

        {uiState.status === 'submitting' && (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground animate-pulse">กำลังเช็คอิน...</p>
          </div>
        )}

        {uiState.status === 'result' && (
          <div className="flex flex-col gap-3">
            <CheckinResultCard
              result={uiState.result}
              bib={uiState.bib}
              onReset={startCamera}
            />
            {countdown !== null && (
              <p className="text-center text-sm text-muted-foreground">
                กลับสู่การสแกนใน {countdown} วินาที...
              </p>
            )}
          </div>
        )}

        {uiState.status === 'error' && (
          <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-8 text-center">
            <p className="text-xl font-bold text-destructive">เกิดข้อผิดพลาด</p>
            <p className="mt-2 text-muted-foreground">{uiState.message}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button className="w-full" onClick={startCamera}>
                ลองอีกครั้ง
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-2"
                onClick={openManual}
              >
                กรอกหมายเลข BIB เอง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
