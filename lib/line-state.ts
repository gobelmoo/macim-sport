import {
  getActiveEvents,
  getAthleteByLineUserId,
  getRegisteredActiveEventsWithBib,
} from '@/db/queries/line'
import { replyMessage } from '@/lib/line-client'
import {
  athleteSummaryFlex,
  errorMessage,
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

export function resolveFallbackText(settings: {
  fallbackEnabled: boolean
  fallbackMessage: string
}): string | null {
  if (!settings.fallbackEnabled) return null
  const text = settings.fallbackMessage.trim()
  return text.length > 0 ? text : null
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
      await replyMessage(replyToken, [errorMessage('no_events')])
      return
    }

    await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, available, LIFF_BASE, APP_BASE)])
    return
  }

  if (allActive.length === 0) {
    await replyMessage(replyToken, [errorMessage('no_events')])
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
  if (!TRIGGER_KEYWORDS.has(text.toLowerCase())) return
  await startFlow(lineUserId, replyToken)
}

export async function handlePostback(
  lineUserId: string,
  _data: Record<string, string>,
  replyToken: string,
): Promise<void> {
  await startFlow(lineUserId, replyToken)
}
