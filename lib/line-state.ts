import {
  getActiveEvents,
  getAthleteByLineUserId,
  getEventById,
  getLineSession,
  getRegisteredActiveEventsWithBib,
  getRegisteredEventIds,
  getRegistrationByBibAndEvent,
  linkAthleteLineId,
  upsertLineSession,
} from '@/db/queries/line'
import { replyMessage } from '@/lib/line-client'
import {
  askBibMessage,
  athleteSummaryFlex,
  confirmRecordFlex,
  consentFlex,
  errorMessage,
  liffLinkMessage,
  successMessage,
  welcomeBackMessage,
  welcomeNewMessage,
} from '@/lib/line-messages'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

export function isValidBib(bib: string): boolean {
  return /^[A-Za-z0-9\-]{1,10}$/.test(bib)
}

function liffUrl(eventId: string, bib: string): string {
  return `${LIFF_BASE}?eventId=${encodeURIComponent(eventId)}&bib=${encodeURIComponent(bib)}`
}

// ─── Entry points ──────────────────────────────────────────────────────────

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

    // Has at least 1 registered active event → show combined or registered-only carousel
    if (registeredActive.length > 0) {
      const registeredWithBib = await getRegisteredActiveEventsWithBib(existingAthlete.athleteId)
      if (available.length > 0) {
        await upsertLineSession(lineUserId, { state: 'awaiting_event', eventId: null })
      }
      await replyMessage(replyToken, [
        athleteSummaryFlex(existingAthlete.firstName, registeredWithBib, available, LIFF_BASE),
      ])
      return
    }

    // No registered active events → existing behavior
    if (available.length === 0) {
      await replyMessage(replyToken, [errorMessage('no_events')])
      return
    }

    if (available.length === 1) {
      await upsertLineSession(lineUserId, { state: 'awaiting_bib', eventId: available[0].eventId })
      await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, [available[0]])])
      return
    }

    await upsertLineSession(lineUserId, { state: 'awaiting_event', eventId: null })
    await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, available)])
    return
  }

  if (allActive.length === 0) {
    await replyMessage(replyToken, [errorMessage('no_events')])
    return
  }

  if (allActive.length === 1) {
    await upsertLineSession(lineUserId, { state: 'awaiting_bib', eventId: allActive[0].eventId })
    await replyMessage(replyToken, [welcomeNewMessage([allActive[0]])])
    return
  }

  await upsertLineSession(lineUserId, { state: 'awaiting_event', eventId: null })
  await replyMessage(replyToken, [welcomeNewMessage(allActive)])
}

export async function handleText(
  lineUserId: string,
  text: string,
  replyToken: string,
): Promise<void> {
  const session = await getLineSession(lineUserId)

  if (!session || session.state === 'idle' || session.state === 'done' || session.state === 'awaiting_event') {
    await startFlow(lineUserId, replyToken)
    return
  }

  if (session.state === 'awaiting_bib') {
    await handleBib(lineUserId, text, session.eventId!, replyToken)
    return
  }

  await replyMessage(replyToken, [
    { type: 'text', text: 'กรุณาตอบด้วยการกดปุ่มด้านบน' },
  ])
}

export async function handleBib(
  lineUserId: string,
  bib: string,
  eventId: string,
  replyToken: string,
): Promise<void> {
  if (!isValidBib(bib)) {
    await replyMessage(replyToken, [errorMessage('bib_format')])
    return
  }

  const registration = await getRegistrationByBibAndEvent(bib, eventId)

  if (registration) {
    if (registration.athleteLineUserId) {
      await replyMessage(replyToken, [errorMessage('bib_taken')])
      return
    }

    await upsertLineSession(lineUserId, { state: 'awaiting_confirm', bibNumber: bib })
    await replyMessage(replyToken, [
      confirmRecordFlex(
        registration.athleteFirstName ?? '',
        registration.athleteLastName ?? '',
        registration.athleteDateOfBirth ?? '',
      ),
    ])
    return
  }

  const existingAthlete = await getAthleteByLineUserId(lineUserId)

  if (existingAthlete) {
    await upsertLineSession(lineUserId, { state: 'done' })
    await replyMessage(replyToken, [liffLinkMessage(liffUrl(eventId, bib))])
    return
  }

  await upsertLineSession(lineUserId, { state: 'awaiting_consent', bibNumber: bib })
  await replyMessage(replyToken, [consentFlex()])
}

export async function handlePostback(
  lineUserId: string,
  data: Record<string, string>,
  replyToken: string,
): Promise<void> {
  const session = await getLineSession(lineUserId)
  const action = data.action

  if (action === 'select_event') {
    const eventId = data.eventId
    const event = await getEventById(eventId)
    if (!event) {
      await replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบงานที่เลือก' }])
      return
    }
    await upsertLineSession(lineUserId, { state: 'awaiting_bib', eventId })
    await replyMessage(replyToken, [askBibMessage(event.eventName)])
    return
  }

  if (action === 'confirm_yes') {
    if (!session?.eventId || !session.bibNumber) {
      await startFlow(lineUserId, replyToken)
      return
    }
    if (session.state !== 'awaiting_confirm') {
      await startFlow(lineUserId, replyToken)
      return
    }
    const registration = await getRegistrationByBibAndEvent(session.bibNumber, session.eventId)
    if (!registration?.athleteId) {
      await replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูล กรุณาลองใหม่อีกครั้ง' }])
      return
    }
    await linkAthleteLineId(registration.athleteId, lineUserId)
    await upsertLineSession(lineUserId, { state: 'done' })
    const event = await getEventById(session.eventId)
    await replyMessage(replyToken, [
      successMessage(
        registration.athleteFirstName ?? '',
        session.bibNumber,
        event?.eventName ?? '',
      ),
    ])
    return
  }

  if (action === 'confirm_no') {
    await upsertLineSession(lineUserId, { state: 'awaiting_bib', bibNumber: null })
    const eventId = session?.eventId
    if (eventId) {
      const event = await getEventById(eventId)
      await replyMessage(replyToken, [askBibMessage(event?.eventName ?? '')])
    } else {
      await startFlow(lineUserId, replyToken)
    }
    return
  }

  if (action === 'consent_accept') {
    if (!session?.eventId || !session.bibNumber) {
      await startFlow(lineUserId, replyToken)
      return
    }
    await upsertLineSession(lineUserId, { state: 'done' })
    await replyMessage(replyToken, [liffLinkMessage(liffUrl(session.eventId, session.bibNumber))])
    return
  }

  if (action === 'consent_decline') {
    await upsertLineSession(lineUserId, { state: 'idle', eventId: null, bibNumber: null })
    await replyMessage(replyToken, [errorMessage('consent_declined')])
    return
  }

  await replyMessage(replyToken, [{ type: 'text', text: 'กรุณาลองใหม่อีกครั้ง' }])
}
