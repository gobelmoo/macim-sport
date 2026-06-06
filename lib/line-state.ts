import {
  getActiveEvents,
  getAthleteByLineUserId,
  getRegisteredActiveEventsWithBib,
  getRegisteredEventIds,
} from '@/db/queries/line'
import { replyMessage } from '@/lib/line-client'
import {
  athleteSummaryFlex,
  errorMessage,
  welcomeBackMessage,
  welcomeNewMessage,
} from '@/lib/line-messages'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

export function isValidBib(bib: string): boolean {
  return /^[A-Za-z0-9\-]{1,10}$/.test(bib)
}

export async function startFlow(lineUserId: string, replyToken: string): Promise<void> {
  const existingAthlete = await getAthleteByLineUserId(lineUserId)
  const allActive = await getActiveEvents()

  console.log('[startFlow]', {
    lineUserId,
    allActiveCount: allActive.length,
    hasAthlete: !!existingAthlete,
  })

  if (existingAthlete) {
    const registeredIds = await getRegisteredEventIds(existingAthlete.athleteId)
    const available = allActive.filter((e) => !registeredIds.includes(e.eventId))
    const registeredActive = allActive.filter((e) => registeredIds.includes(e.eventId))

    console.log('[startFlow] returning athlete', {
      registeredCount: registeredIds.length,
      availableCount: available.length,
    })

    if (registeredActive.length > 0) {
      const registeredWithBib = await getRegisteredActiveEventsWithBib(existingAthlete.athleteId)
      await replyMessage(replyToken, [
        athleteSummaryFlex(existingAthlete.firstName, registeredWithBib, available, LIFF_BASE),
      ])
      return
    }

    if (available.length === 0) {
      await replyMessage(replyToken, [errorMessage('no_events')])
      return
    }

    await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, available, LIFF_BASE)])
    return
  }

  if (allActive.length === 0) {
    await replyMessage(replyToken, [errorMessage('no_events')])
    return
  }

  await replyMessage(replyToken, [welcomeNewMessage(allActive, LIFF_BASE)])
}

export async function handleText(
  lineUserId: string,
  _text: string,
  replyToken: string,
): Promise<void> {
  await startFlow(lineUserId, replyToken)
}

export async function handlePostback(
  lineUserId: string,
  _data: Record<string, string>,
  replyToken: string,
): Promise<void> {
  await startFlow(lineUserId, replyToken)
}
