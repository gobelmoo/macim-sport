import type { ActiveEvent } from '@/db/queries/line'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TextMessage {
  type: 'text'
  text: string
}

interface FlexMessage {
  type: 'flex'
  altText: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contents: any
}

export type LineMessage = TextMessage | FlexMessage

// ─── Constants ─────────────────────────────────────────────────────────────

const CTA_TEXT = 'ทักแชทหาเรา เพื่อรับสิทธิ์ต่างๆฟรีที่บูธ MACIM-SPORT ในอีเว้นท์ที่คุณเข้าร่วม'

// ─── Bubble builders ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function availableBubble(event: ActiveEvent, liffBase: string, appBase: string): any {
  const isActive = event.status === 'active'
  const headerBg = isActive ? '#1D86E8' : '#888888'
  const headerText = isActive ? '🎯 ลงทะเบียนรับบริการฟรี' : '🔜 เร็วๆนี้'

  const bodyContents: any[] = [
    { type: 'text', text: event.eventName, weight: 'bold', wrap: true },
  ]
  if (event.description) {
    bodyContents.push({
      type: 'text',
      text: event.description,
      wrap: true,
      size: 'sm',
      color: '#555555',
      margin: 'sm',
    })
  }

  const footerContents: any[] = []
  if (isActive) {
    footerContents.push({
      type: 'button',
      style: 'primary',
      action: {
        type: 'uri',
        label: 'ลงทะเบียนรับสิทธิ์ฟรี',
        uri: `${liffBase}?eventId=${encodeURIComponent(event.eventId)}`,
      },
    })
  }
  footerContents.push({
    type: 'button',
    style: 'secondary',
    action: {
      type: 'uri',
      label: 'ดูรายละเอียด',
      uri: `${appBase}/event/${encodeURIComponent(event.eventId)}`,
    },
  })

  const bubble: any = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerBg,
      paddingAll: 'md',
      contents: [{ type: 'text', text: headerText, color: '#ffffff', weight: 'bold', size: 'sm' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerContents,
    },
  }

  if (event.eventLogoUrl) {
    bubble.hero = {
      type: 'image',
      url: event.eventLogoUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    }
  }

  return bubble
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registeredBubble(event: { eventId: string; eventName: string; bibNumber: string }, liffBase: string, appBase: string): any {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#06C755',
      paddingAll: 'md',
      contents: [{ type: 'text', text: '✅ คุณได้รับสิทธิ์แล้ว', color: '#ffffff', weight: 'bold', size: 'sm' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: event.eventName, weight: 'bold', wrap: true },
        { type: 'text', text: `BIB: ${event.bibNumber}`, size: 'sm', color: '#555555' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: 'รับสิทธิ์แล้ว ✓',
            uri: `${appBase}/event/${encodeURIComponent(event.eventId)}`,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: 'จัดการข้อมูล',
            uri: `${liffBase}?eventId=${encodeURIComponent(event.eventId)}&bib=${encodeURIComponent(event.bibNumber)}`,
          },
        },
      ],
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flexCarousel(bubbles: any[], altText: string): FlexMessage {
  if (bubbles.length === 1) {
    return { type: 'flex', altText, contents: bubbles[0] }
  }
  return { type: 'flex', altText, contents: { type: 'carousel', contents: bubbles } }
}

// ─── Message Builders ──────────────────────────────────────────────────────

function availableEventsCarousel(events: ActiveEvent[], liffBase: string, appBase: string, firstName?: string): FlexMessage {
  const bubbles = events.slice(0, 10).map((e) => availableBubble(e, liffBase, appBase))
  const altText = firstName ? `${firstName} — ${CTA_TEXT}` : CTA_TEXT
  return flexCarousel(bubbles, altText)
}

export function welcomeNewMessage(events: ActiveEvent[], liffBase: string, appBase: string): LineMessage {
  return availableEventsCarousel(events, liffBase, appBase)
}

export function welcomeBackMessage(firstName: string, events: ActiveEvent[], liffBase: string, appBase: string): LineMessage {
  return availableEventsCarousel(events, liffBase, appBase, firstName)
}

export function successMessage(firstName: string, bib: string, eventName: string): LineMessage {
  return {
    type: 'text',
    text: `✅ ลงทะเบียนสำเร็จ!\nชื่อ: ${firstName}\nBIB: ${bib}\nงาน: ${eventName}\n\nพบกันที่งาน! 🏃‍♂️`,
  }
}

type ErrorType = 'no_events'

const ERROR_TEXTS: Record<ErrorType, string> = {
  no_events: 'ขณะนี้ไม่มีงานที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน',
}

export function errorMessage(type: ErrorType): LineMessage {
  return { type: 'text', text: ERROR_TEXTS[type] }
}

// ─── Athlete Summary Flex ──────────────────────────────────────────────────

export function athleteSummaryFlex(
  firstName: string,
  registered: { eventId: string; eventName: string; bibNumber: string }[],
  available: ActiveEvent[],
  liffBase: string,
  appBase: string,
): LineMessage {
  const bubbles = [
    ...available.map((e) => availableBubble(e, liffBase, appBase)),
    ...registered.map((e) => registeredBubble(e, liffBase, appBase)),
  ].slice(0, 10)

  return flexCarousel(bubbles, `${firstName} — ${CTA_TEXT}`)
}
