'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { performSelfCheckin } from '../actions'
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
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    if (videoRef.current?.srcObject) {
      ;(videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setUiState({ status: 'scanning' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      // Lazy-load Tesseract worker
      const { createWorker } = await import('tesseract.js')
      workerRef.current = await createWorker('eng', 1, {
        logger: () => {},
      })
      await workerRef.current.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7' as never, // single line
      })

      // Scan loop every 600ms
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !workerRef.current) return
        if (videoRef.current.readyState < 2) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const w = video.videoWidth
        const h = video.videoHeight
        canvas.width = w
        canvas.height = h

        // Crop center strip (ROI)
        const cropH = Math.floor(h * 0.3)
        const cropY = Math.floor(h * 0.35)
        ctx.drawImage(video, 0, cropY, w, cropH, 0, 0, w, cropH)

        const { data } = await workerRef.current.recognize(canvas)
        const raw = data.text.replace(/\D/g, '').trim()

        if (raw.length >= 1 && raw.length <= 5 && data.confidence > 70) {
          stopCamera()
          await workerRef.current.terminate()
          workerRef.current = null
          setUiState({ status: 'confirming', bib: raw })
        }
      }, 600)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องได้'
      setUiState({ status: 'error', message: msg })
    }
  }, [stopCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      workerRef.current?.terminate()
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
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-muted-foreground">{eventName}</p>
        <h1 className="text-2xl font-bold">{stationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Self Check-in</p>
      </div>

      <div className="w-full max-w-sm">
        {/* IDLE */}
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

        {/* SCANNING */}
        {uiState.status === 'scanning' && (
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4]">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* ROI guide */}
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
            <Button variant="outline" size="lg" className="w-full" onClick={() => { stopCamera(); reset() }}>
              ยกเลิก
            </Button>
          </div>
        )}

        {/* CONFIRMING */}
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

        {/* SUBMITTING */}
        {uiState.status === 'submitting' && (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground animate-pulse">กำลังเช็คอิน...</p>
          </div>
        )}

        {/* RESULT */}
        {uiState.status === 'result' && (
          <ResultCard result={uiState.result} bib={uiState.bib} onReset={reset} />
        )}

        {/* ERROR */}
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

function ResultCard({
  result,
  bib,
  onReset,
}: {
  result: CheckinResult
  bib: string
  onReset: () => void
}) {
  if (!result.found) {
    return (
      <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-8 text-center">
        <p className="text-3xl font-bold text-destructive">ไม่พบข้อมูล</p>
        <p className="mt-2 text-xl text-muted-foreground">BIB: {bib}</p>
        <p className="mt-3 text-xl">อนุญาตให้เข้าใช้บริการได้</p>
        {result.error && <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>}
        <Button variant="outline" size="lg" className="mt-6 w-full h-14" onClick={onReset}>
          เช็คอินใหม่
        </Button>
      </div>
    )
  }

  const { athlete, isDuplicate } = result
  const initials = `${athlete.firstName[0] ?? ''}${athlete.lastName[0] ?? ''}`.toUpperCase()

  if (isDuplicate) {
    return (
      <div className="rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-2xl font-bold">
          {initials}
        </div>
        <p className="text-2xl font-bold">{athlete.firstName} {athlete.lastName}</p>
        <p className="mt-1 font-mono text-xl text-muted-foreground">BIB: {bib}</p>
        <div className="mt-4 rounded-xl bg-amber-500/20 px-4 py-3">
          <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">เคยใช้บริการแล้ว</p>
          <p className="text-sm text-amber-600 dark:text-amber-300">เข้าได้ปกติ — ไม่ได้รับ Stamp เพิ่ม</p>
        </div>
        <Button variant="outline" size="lg" className="mt-6 w-full h-14" onClick={onReset}>
          เช็คอินใหม่
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-green-500 bg-green-500/10 p-8 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-2xl font-bold">
        {initials}
      </div>
      <p className="text-2xl font-bold">{athlete.firstName} {athlete.lastName}</p>
      <p className="mt-1 font-mono text-xl text-muted-foreground">BIB: {bib}</p>
      <div className="mt-4 rounded-xl bg-green-500/20 px-4 py-3">
        <p className="text-lg font-semibold text-green-700 dark:text-green-400">เช็คอินสำเร็จ ✓</p>
        <p className="text-sm text-green-600 dark:text-green-300">ได้รับ Stamp เรียบร้อยแล้ว</p>
      </div>
      <Button variant="outline" size="lg" className="mt-6 w-full h-14" onClick={onReset}>
        เช็คอินใหม่
      </Button>
    </div>
  )
}
