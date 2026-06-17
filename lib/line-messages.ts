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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heroBlock(url: string | null): any {
  if (!url) return undefined
  return { type: 'image', url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
}

// ─── Bubble builders ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function availableBubble(event: ActiveEvent, liffBase: string, appBase: string): any {
  const isActive = event.status === 'active'
  const headerBg = isActive ? '#1D86E8' : '#888888'
  const headerText = isActive ? '🎯 ลงทะเบียนรับบริการฟรี' : '🔜 เร็วๆนี้'
  const encodedId = encodeURIComponent(event.eventId)

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
        uri: `${liffBase}?eventId=${encodedId}`,
      },
    })
  }
  footerContents.push({
    type: 'button',
    style: 'secondary',
    action: {
      type: 'uri',
      label: 'ดูรายละเอียด',
      uri: `${appBase}/event/${encodedId}`,
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

  bubble.hero = heroBlock(event.eventLogoUrl)

  return bubble
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registeredBubble(event: { eventId: string; eventName: string; eventLogoUrl: string | null; bibNumber: string }, liffBase: string, appBase: string): any {
  const encodedId = encodeURIComponent(event.eventId)
  const bubble: any = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#06C755',
      paddingAll: 'md',
      contents: [{ type: 'text', text: '✅ ได้รับสิทธิ์แล้ว', color: '#ffffff', weight: 'bold', size: 'sm' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: event.eventName, weight: 'bold', wrap: true },
        { type: 'text', text: 'คุณได้รับสิทธิ์แล้ว พบกันที่บูธ MACIM-SPORT', wrap: true, size: 'sm', color: '#555555', margin: 'sm' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          action: {
            type: 'uri',
            label: `BIB ${event.bibNumber}`,
            uri: `${liffBase}?eventId=${encodedId}&bib=${encodeURIComponent(event.bibNumber)}`,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: 'ดูรายละเอียด',
            uri: `${appBase}/event/${encodedId}`,
          },
        },
      ],
    },
  }
  bubble.hero = heroBlock(event.eventLogoUrl)
  return bubble
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

export function textMessage(text: string): LineMessage {
  return { type: 'text', text }
}

// ─── Athlete Summary Flex ──────────────────────────────────────────────────

export function athleteSummaryFlex(
  firstName: string,
  registered: { eventId: string; eventName: string; startDate: string; eventLogoUrl: string | null; bibNumber: string }[],
  available: ActiveEvent[],
  liffBase: string,
  appBase: string,
): LineMessage {
  const allItems: [string, any][] = [
    ...available.map((e) => [e.startDate, availableBubble(e, liffBase, appBase)] as [string, any]),
    ...registered.map((e) => [e.startDate, registeredBubble(e, liffBase, appBase)] as [string, any]),
  ]
  allItems.sort(([a], [b]) => a.localeCompare(b))
  const bubbles = allItems.slice(0, 10).map(([, bubble]) => bubble)

  return flexCarousel(bubbles, `${firstName} — ${CTA_TEXT}`)
}

// ─── Queue Ticket Flex ───────────────────────────────────────────────────────

export function queueTicketMessage(input: {
  counterName: string
  displayNumber: number
  statusUrl: string
}): LineMessage {
  return {
    type: 'flex',
    altText: `คิวของคุณคือหมายเลข ${input.displayNumber} (${input.counterName})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1D86E8',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: '🎫 รับคิวสำเร็จ',
            color: '#ffffff',
            weight: 'bold',
            size: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: input.counterName, size: 'sm', color: '#555555' },
          {
            type: 'text',
            text: String(input.displayNumber),
            weight: 'bold',
            size: '5xl',
            align: 'center',
            color: '#1D86E8',
          },
          {
            type: 'text',
            text: 'หมายเลขคิวของคุณ',
            size: 'xs',
            color: '#888888',
            align: 'center',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: 'ดูสถานะคิว / เวลารอ',
              uri: input.statusUrl,
            },
          },
        ],
      },
    },
  }
}
