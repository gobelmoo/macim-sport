# BIB Custom Virtual Keyboard — Design Spec
Date: 2026-06-06

## Context

หน้า self-checkin (`/self-checkin/[token]`) ตั้ง tablet เป็น kiosk นักกีฬาเดินต่อคิวมาสแกน BIB
ปัจจุบันมีปุ่ม "กรอกเอง" ที่เปิด `<Input>` ซึ่งใช้ OS keyboard — ไม่เหมาะกับ kiosk เพราะ OS keyboard บัง UI, ขนาดปุ่มเล็ก, ช้า

BIB format: ตัวเลข 0–9 + ตัวอักษร A–Z + hyphen `-` เช่น `RUN-1001`, `A100`, `42`

## Goal

1. **Custom virtual keyboard** ที่ออกแบบสำหรับ tablet kiosk โดยเฉพาะ
2. **Auto-timeout 15s** — ถ้าสแกนไม่สำเร็จใน 15 วินาที เปิด keyboard อัตโนมัติ

## Component: `BibKeyboard`

### Props
```ts
interface BibKeyboardProps {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onBack: () => void
}
```

### Layout

```
┌────────────────────────────────┐
│   [  R U N - 1 0 0 1  |  ]    │  ← display bar, font-mono text-4xl
├──────────────────────────────┤
│  1   2   3   4   5   6        │  ← h-14 text-2xl (large digit row)
│  7   8   9   0   -   ⌫        │  ← h-14 text-2xl
├──────────────────────────────┤
│  A B C D E F G H I            │  ← h-10 text-base flex-wrap
│  J K L M N O P Q R            │
│  S T U V W X Y Z              │
├──────────────────────────────┤
│  [← กลับสแกน]  [✓ ยืนยัน]    │  ← h-14, ยืนยัน disabled ถ้า value ว่าง
└────────────────────────────────┘
```

### Behavior
- กด digit/letter/hyphen → append ถ้า `value.length < 12`
- กด ⌫ → ตัดตัวสุดท้าย
- `value` แสดงใน display bar, มี `|` กะพริบท้าย
- ปุ่ม "ยืนยัน" disabled เมื่อ `value === ''`
- ปุ่ม "← กลับสแกน" → `onBack()` → กลับ scanning mode

## Auto-timeout ใน `OcrTerminal`

```
uiState.status === 'scanning'
  → useEffect starts 15s timer
  → ถ้า status ยังเป็น 'scanning' หลัง 15s → openManual()
  → ถ้า status เปลี่ยน (confirmed / manual) → clearTimeout
```

## File changes

| File | Action |
|---|---|
| `_components/bib-keyboard.tsx` | สร้างใหม่ |
| `_components/ocr-terminal.tsx` | (1) เพิ่ม 15s timeout effect; (2) เปลี่ยน manual UI ให้ใช้ `BibKeyboard` แทน `<Input>` |

## Out of scope
- Haptic feedback
- Animation ปุ่ม press
- Long-press delete (ลบทีละตัวพอ)
