import {
  getActiveEvents,
  getAthleteByLineUserId,
  getRegisteredActiveEventsWithBib,
  getLineSettings,
} from '@/db/queries/line'
import { replyMessage } from '@/lib/line-client'
import {
  athleteSummaryFlex,
  textMessage,
  welcomeBackMessage,
  welcomeNewMessage,
} from '@/lib/line-messages'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
const APP_BASE = (
  process.env.AUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
).replace(/\/$/, '')

export function isValidBib(bib: string): boolean {
  return /^[A-Za-z0-9\-]{1,10}$/.test(bib)
}

export function shouldAutoReply(settings: { autoReplyEnabled: boolean }): boolean {
  return settings.autoReplyEnabled
}

export function resolveFallbackText(settings: {
  fallbackEnabled: boolean
  fallbackMessage: string
}): string | null {
  if (!settings.fallbackEnabled) return null
  const text = settings.fallbackMessage.trim()
  return text.length > 0 ? text : null
}

const DEFAULT_NO_EVENTS_TEXT = 'ขณะนี้ยังไม่มีกิจกรรมที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน'

// ข้อความตอบเมื่อ user พิมพ์ keyword ถูก แต่ยังไม่มีงานเปิดรับสมัคร
// ตอบเสมอ ไม่ผูกกับสวิตช์ fallback (fallbackEnabled)
export function resolveNoEventsText(settings: { fallbackMessage: string }): string {
  const text = settings.fallbackMessage.trim()
  return text.length > 0 ? text : DEFAULT_NO_EVENTS_TEXT
}

export function resolveSettingsToSave(
  input: {
    autoReplyEnabled: boolean
    fallbackPresent: boolean
    fallbackEnabled: boolean
    fallbackMessage: string
  },
  current: { fallbackEnabled: boolean; fallbackMessage: string },
): { autoReplyEnabled: boolean; fallbackEnabled: boolean; fallbackMessage: string } {
  return {
    autoReplyEnabled: input.autoReplyEnabled,
    fallbackEnabled: input.fallbackPresent ? input.fallbackEnabled : current.fallbackEnabled,
    fallbackMessage: input.fallbackPresent ? input.fallbackMessage : current.fallbackMessage,
  }
}

async function replyFallback(replyToken: string): Promise<void> {
  try {
    const settings = await getLineSettings()
    const text = resolveFallbackText(settings)
    if (text) await replyMessage(replyToken, [textMessage(text)])
  } catch (err) {
    console.error('[replyFallback] failed', err)
  }
}

// ตอบเมื่อ user พิมพ์ keyword ถูก แต่ไม่มีงานเปิดรับ — ตอบเสมอ ไม่สนสวิตช์ fallback
async function replyNoEvents(replyToken: string): Promise<void> {
  try {
    const settings = await getLineSettings()
    await replyMessage(replyToken, [textMessage(resolveNoEventsText(settings))])
  } catch (err) {
    console.error('[replyNoEvents] failed', err)
  }
}

export async function startFlow(lineUserId: string, replyToken: string): Promise<void> {
  const [existingAthlete, allActive] = await Promise.all([
    getAthleteByLineUserId(lineUserId),
    getActiveEvents(),
  ])

  console.log('[startFlow]', {
    lineUserId,
    allActiveCount: allActive.length,
    hasAthlete: !!existingAthlete,
  })

  if (existingAthlete) {
    const registeredWithBib = await getRegisteredActiveEventsWithBib(existingAthlete.athleteId)
    const registeredIds = new Set(registeredWithBib.map((e) => e.eventId))
    const available = allActive.filter((e) => !registeredIds.has(e.eventId))

    console.log('[startFlow] returning athlete', {
      registeredCount: registeredWithBib.length,
      availableCount: available.length,
    })

    if (registeredWithBib.length > 0) {
      await replyMessage(replyToken, [
        athleteSummaryFlex(existingAthlete.firstName, registeredWithBib, available, LIFF_BASE, APP_BASE),
      ])
      return
    }

    if (available.length === 0) {
      await replyNoEvents(replyToken)
      return
    }

    await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, available, LIFF_BASE, APP_BASE)])
    return
  }

  if (allActive.length === 0) {
    await replyNoEvents(replyToken)
    return
  }

  await replyMessage(replyToken, [welcomeNewMessage(allActive, LIFF_BASE, APP_BASE)])
}

const TRIGGER_KEYWORDS = new Set(['event', 'promotion'])

export async function handleText(
  lineUserId: string,
  text: string,
  replyToken: string,
): Promise<void> {
  if (!TRIGGER_KEYWORDS.has(text.toLowerCase())) {
    await replyFallback(replyToken)
    return
  }
  await startFlow(lineUserId, replyToken)
}

export async function handlePostback(
  lineUserId: string,
  _data: Record<string, string>,
  replyToken: string,
): Promise<void> {
  await startFlow(lineUserId, replyToken)
}
