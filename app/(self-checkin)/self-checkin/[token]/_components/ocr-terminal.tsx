'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BibKeyboard } from './bib-keyboard'
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
  | { status: 'timeout-dialog' }
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
  const historyRef = useRef<string[]>([])
  const [uiState, setUiState] = useState<UIState>({ status: 'idle' })
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

  const resetToIdle = useCallback(() => {
    stopCamera()
    setUiState({ status: 'idle' })
  }, [stopCamera])

  const openManual = useCallback(() => {
    stopCamera()
    setUiState({ status: 'manual', value: '' })
  }, [stopCamera])

  const openTimeoutDialog = useCallback(() => {
    stopCamera()
    setUiState({ status: 'timeout-dialog' })
  }, [stopCamera])

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
    setDebug(null)
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

      historyRef.current = []

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

          if (raw.length >= 2 && raw.length <= 10) {
            const history = historyRef.current
            history.push(raw)
            if (history.length > 5) history.shift()

            const counts: Record<string, number> = {}
            for (const v of history) counts[v] = (counts[v] ?? 0) + 1
            const [topVal, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

            if (topCount >= 3) {
              stopCamera()
              setUiState({ status: 'confirming', bib: topVal })
              return
            }
          } else {
            historyRef.current = []
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

  // Auto-reset to idle after result
  useEffect(() => {
    if (uiState.status !== 'result') { setCountdown(null); return }
    setCountdown(AUTO_RESET_SECONDS)
    const tick = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null))
    }, 1000)
    const reset = setTimeout(resetToIdle, AUTO_RESET_SECONDS * 1000)
    return () => { clearInterval(tick); clearTimeout(reset) }
  }, [uiState.status, resetToIdle])

  // Show timeout dialog after 15s of scanning without result
  useEffect(() => {
    if (uiState.status !== 'scanning') return
    const t = setTimeout(openTimeoutDialog, 15_000)
    return () => clearTimeout(t)
  }, [uiState.status, openTimeoutDialog])

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

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-8">
      <div className="mb-6 text-center">
        <p className="text-muted-foreground">{eventName}</p>
        <h1 className="text-2xl font-bold">{stationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Self Check-in</p>
      </div>

      <div className={uiState.status === 'confirming' ? 'w-full px-4' : 'w-full max-w-sm'}>

        {uiState.status === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-10 text-center w-full">
              <p className="text-5xl mb-4">📷</p>
              <p className="text-xl font-semibold">พร้อมสแกน BIB</p>
              <p className="mt-1 text-sm text-muted-foreground">กดปุ่มเพื่อเริ่ม</p>
            </div>
            <Button size="lg" className="w-full h-16 text-xl" onClick={startCamera}>
              สแกน BIB
            </Button>
            <Button size="lg" variant="outline" className="w-full h-14 text-base" onClick={openManual}>
              ⌨️ กรอกหมายเลขเอง
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
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={resetToIdle}>
                ยกเลิก
              </Button>
              <Button variant="outline" className="flex-1 h-12" onClick={openManual}>
                ⌨️ กรอกเอง
              </Button>
            </div>
          </div>
        )}

        {uiState.status === 'timeout-dialog' && (
          <div className="flex flex-col gap-4 text-center py-4">
            <div className="rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-8">
              <p className="text-5xl mb-3">📷</p>
              <p className="text-xl font-bold">อ่าน BIB ไม่ได้</p>
              <p className="mt-2 text-muted-foreground">
                กล้องอ่านหมายเลขไม่ชัด ลองวาง BIB ให้ตรงกรอบแล้วสแกนใหม่ หรือกรอกเลขเอง
              </p>
            </div>
            <Button size="lg" className="w-full h-14 text-lg" onClick={startCamera}>
              สแกนใหม่
            </Button>
            <Button size="lg" variant="outline" className="w-full h-14 text-base" onClick={openManual}>
              ⌨️ กรอกหมายเลขเอง
            </Button>
          </div>
        )}

        {uiState.status === 'manual' && (
          <BibKeyboard
            value={uiState.value}
            onChange={(v) => setUiState({ status: 'manual', value: v })}
            onConfirm={() => handleConfirm(uiState.value)}
            onBack={startCamera}
          />
        )}

        {uiState.status === 'confirming' && (
          <div className="flex flex-col gap-6 text-center">
            <div className="rounded-2xl border-2 border-yellow-500 bg-yellow-500/10 p-10">
              <p className="text-2xl text-muted-foreground">พบหมายเลข BIB</p>
              <p className="mt-3 font-mono text-8xl font-bold">{uiState.bib}</p>
              <p className="mt-4 text-lg text-muted-foreground">ยืนยันหมายเลขนี้ถูกต้องหรือไม่?</p>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-16 text-lg" onClick={startCamera}>
                สแกนใหม่
              </Button>
              <Button className="flex-1 h-16 text-xl" onClick={() => handleConfirm(uiState.bib)}>
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
              onReset={resetToIdle}
            />
            {countdown !== null && (
              <p className="text-center text-sm text-muted-foreground">
                กลับหน้าหลักใน {countdown} วินาที...
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
              <Button variant="outline" className="w-full" onClick={openManual}>
                ⌨️ กรอกหมายเลขเอง
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
