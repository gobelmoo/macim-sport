import type { ActiveEvent } from '@/db/queries/line'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TextMessage {
  type: 'text'
  text: string
  quickReply?: { items: QuickReplyItem[] }
}

interface QuickReplyItem {
  type: 'action'
  action: { type: 'postback'; label: string; data: string }
}

interface FlexMessage {
  type: 'flex'
  altText: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contents: any
}

export type LineMessage = TextMessage | FlexMessage

// ─── Helpers ───────────────────────────────────────────────────────────────

function postbackData(obj: Record<string, string>): string {
  return JSON.stringify(obj)
}

function eventQuickReply(events: ActiveEvent[]): { items: QuickReplyItem[] } {
  return {
    items: events.map((e) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: e.eventName.slice(0, 20),
        data: postbackData({ action: 'select_event', eventId: e.eventId }),
      },
    })),
  }
}

// ─── Message Builders ──────────────────────────────────────────────────────

export function welcomeNewMessage(events: ActiveEvent[]): LineMessage {
  if (events.length === 1) {
    return {
      type: 'text',
      text: `ยินดีต้อนรับสู่ระบบลงทะเบียนกีฬา 🏃\nงาน: ${events[0].eventName}\nกรุณาพิมพ์หมายเลข BIB ของคุณ`,
    }
  }
  return {
    type: 'text',
    text: 'ยินดีต้อนรับสู่ระบบลงทะเบียนกีฬา 🏃\nมีงานที่เปิดรับลงทะเบียน — เลือกงานที่ต้องการ:',
    quickReply: eventQuickReply(events),
  }
}

export function welcomeBackMessage(firstName: string, events: ActiveEvent[]): LineMessage {
  if (events.length === 0) {
    return {
      type: 'text',
      text: `ยินดีต้อนรับกลับ ${firstName} 👋\nขณะนี้ไม่มีงานใหม่ที่เปิดรับลงทะเบียน`,
    }
  }
  if (events.length === 1) {
    return {
      type: 'text',
      text: `ยินดีต้อนรับกลับ ${firstName} 👋\nงาน: ${events[0].eventName}\nกรุณาพิมพ์หมายเลข BIB ของคุณ`,
    }
  }
  return {
    type: 'text',
    text: `ยินดีต้อนรับกลับ ${firstName} 👋\nเลือกงานที่ต้องการลงทะเบียนใหม่:`,
    quickReply: eventQuickReply(events),
  }
}

export function askBibMessage(eventName: string): LineMessage {
  return {
    type: 'text',
    text: `งาน: ${eventName}\nกรุณาพิมพ์หมายเลข BIB ของคุณ (ตัวเลข/อักษร/- ไม่เกิน 10 ตัว)`,
  }
}

export function consentFlex(): LineMessage {
  return {
    type: 'flex',
    altText: 'กรุณายืนยันการยินยอมข้อมูลส่วนบุคคล (PDPA)',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'ข้อตกลงการใช้ข้อมูลส่วนบุคคล',
            weight: 'bold',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ระบบจะเก็บข้อมูลชื่อ นามสกุล วันเกิด และ LINE ID ของท่านเพื่อใช้ในการลงทะเบียนงานกีฬาเท่านั้น ข้อมูลจะไม่ถูกเปิดเผยแก่บุคคลภายนอก',
            wrap: true,
            size: 'sm',
            color: '#555555',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: 'ยอมรับ',
              data: postbackData({ action: 'consent_accept' }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ไม่ยอมรับ',
              data: postbackData({ action: 'consent_decline' }),
            },
          },
        ],
      },
    },
  }
}

export function confirmRecordFlex(
  firstName: string,
  lastName: string,
  dob: string,
): LineMessage {
  return {
    type: 'flex',
    altText: 'ยืนยันข้อมูลนักกีฬา',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'พบข้อมูลนักกีฬา', weight: 'bold' },
          { type: 'text', text: `ชื่อ: ${firstName} ${lastName}`, size: 'sm' },
          { type: 'text', text: `วันเกิด: ${dob}`, size: 'sm' },
          {
            type: 'text',
            text: 'ข้อมูลนี้ใช่ท่านหรือไม่?',
            size: 'sm',
            color: '#555555',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: 'ใช่ คือฉัน',
              data: postbackData({ action: 'confirm_yes' }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ไม่ใช่',
              data: postbackData({ action: 'confirm_no' }),
            },
          },
        ],
      },
    },
  }
}

export function liffLinkMessage(liffUrl: string): LineMessage {
  return {
    type: 'text',
    text: `ยอดเยี่ยม! กรุณากรอกข้อมูลให้ครบถ้วน:\n${liffUrl}`,
  }
}

export function successMessage(firstName: string, bib: string, eventName: string): LineMessage {
  return {
    type: 'text',
    text: `✅ ลงทะเบียนสำเร็จ!\nชื่อ: ${firstName}\nBIB: ${bib}\nงาน: ${eventName}\n\nพบกันที่งาน! 🏃‍♂️`,
  }
}

type ErrorType = 'bib_format' | 'bib_taken' | 'no_events' | 'consent_declined'

const ERROR_TEXTS: Record<ErrorType, string> = {
  bib_format:
    'รูปแบบ BIB ไม่ถูกต้อง\nกรุณาพิมพ์ BIB ใหม่ (ตัวเลข/อักษรอังกฤษ/- ไม่เกิน 10 ตัว)',
  bib_taken: 'BIB นี้ถูกลงทะเบียนไปแล้ว\nหากเชื่อว่ามีข้อผิดพลาด กรุณาติดต่อผู้จัดงาน',
  no_events: 'ขณะนี้ไม่มีงานที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน',
  consent_declined:
    'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว\nหากต้องการลงทะเบียนใหม่ ให้พิมพ์ข้อความใดก็ได้',
}

export function errorMessage(type: ErrorType): LineMessage {
  return { type: 'text', text: ERROR_TEXTS[type] }
}
