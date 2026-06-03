# MACIM SPORT — สรุป Requirements (MVP)

> อ้างอิงจาก: `MACIM_SPORT_MVP_Brief.docx` (มีนาคม 2026)  
> เอกสาร Technical เพิ่มเติม: `MACIM_SPORT_System_Design_v4.docx`

---

## 1. ภาพรวมธุรกิจ

### MACIM SPORT คืออะไร
บริษัทให้บริการ **Recovery Zone** ในงานวิ่งและงานไตรกีฬา นำอุปกรณ์ฟื้นฟูร่างกายมาติดตั้งในพื้นที่งาน เช่น เครื่อง Air Recovery และบ่อแช่น้ำแข็ง

### โมเดลธุรกิจ: B2B2C
```
MACIM SPORT → ขาย Package → Sponsor (บริษัทที่ต้องการโปรโมตแบรนด์)
Sponsor → มอบสิทธิ์ฟรีให้ → นักกีฬาที่เข้าร่วมงาน
```
- **2 งานแรก**: MACIM SPORT เป็น Sponsor เองผ่าน `is_internal = true`

### Station (จุดให้บริการ)
| ประเภท | ชื่อ |
|--------|------|
| `air_recovery` | Air Recovery Zone |
| `ice_bath` | Ice Bath Zone |
| `other` | รองรับประเภทใหม่ในอนาคต (ไม่ต้องแก้ Schema) |

### BIB Number
- หมายเลขประจำตัวนักกีฬาในงานนั้นๆ (ต่างกันในแต่ละงาน)
- ใช้เป็นกุญแจค้นหาตอน Check-in
- มาได้ 2 ทาง: Sponsor Import ไฟล์ หรือ นักกีฬากรอกเองผ่าน LINE OA

### Service Type
| ประเภท | ความหมาย |
|--------|----------|
| `physical_and_digital` | มีอุปกรณ์จริง + ระบบ Digital (โมเดลหลัก) |
| `digital_only` | ระบบ Digital อย่างเดียว (SaaS ในอนาคต) |

---

## 2. System Architecture

### หลักการสำคัญ
- **Web Service คือ Backend หลัก** — ข้อมูลทั้งหมดเก็บที่ MACIM ไม่ใช่ LINE
- LINE OA เป็นแค่ Interface ชั้นนอก ทุก Request ผ่าน Web Service เสมอ
- รองรับนักกีฬาที่ไม่มี LINE (เข้าผ่าน Web Browser ได้โดยตรง)

### Components
| Component | หน้าที่ |
|-----------|--------|
| **Web Service** | Backend หลัก: Database, API, Dashboard, Notification Engine |
| **LINE OA** | Interface สำหรับนักกีฬา — ส่งคำสั่งต่อให้ Web Service |
| **Tablet หน้างาน** | Staff ใช้ค้นหา BIB Number และ Check-in ให้นักกีฬา |

### Authentication (MVP)
| ใคร | วิธี |
|-----|------|
| นักกีฬาผ่าน LINE OA | LINE Authentication ด้วย `line_user_id` |
| MACIM Admin / Sponsor Admin | Email + Password (Back Office) |
| นักกีฬาที่ไม่มี LINE | **POST-MVP** — OTP ทางเบอร์โทร |

---

## 3. Database Schema

### หลักการ
- **Soft Delete ทุก Table** — ใช้ `status: active | hidden` ไม่ลบข้อมูลจริง
- **สร้างครบ 24 Tables ตั้งแต่แรก** — MVP ใช้งานจริง 8 Tables, ที่เหลือรอ Activate

---

### Tables ที่ใช้ใน MVP (8 Tables)

#### Table 1: `users` — Account ผู้ใช้ Back Office
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `user_id` | PK | สร้างอัตโนมัติ |
| `email` | VARCHAR | สำหรับ Login |
| `password_hash` | VARCHAR | ไม่เก็บ Plain Text |
| `phone_number` | VARCHAR | required สำหรับ sponsor_admin/sponsor_staff |
| `role` | ENUM | `super_admin_owner` / `super_admin_manager` / `super_admin_viewer` / `sponsor_admin` / `sponsor_staff` |
| `sponsor_id` | FK → sponsors | null ถ้าเป็น MACIM Admin |
| `line_user_id` | VARCHAR | สำหรับรับ Notification ผ่าน LINE OA |
| `status` | ENUM | `active` / `hidden` |
| `created_at` | TIMESTAMP | — |
| `last_login_at` | TIMESTAMP | — |
| `ip_address` | VARCHAR | IP ล่าสุดที่ Login |

#### Table 2: `sponsors` — ข้อมูลบริษัท Sponsor
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `sponsor_id` | PK | — |
| `sponsor_name` | VARCHAR | ชื่อบริษัท |
| `company_reg_number` | VARCHAR | เลขทะเบียนบริษัท |
| `address_*` (7 fields) | VARCHAR | ที่อยู่ครบ |
| `is_internal` | BOOLEAN | `true` = MACIM SPORT เอง |
| `service_type` | ENUM | `physical_and_digital` / `digital_only` |
| `contact_name` / `contact_email` | VARCHAR | ผู้ติดต่อหลัก |
| `logo_url` | VARCHAR | แสดงใน LINE OA / Dashboard |
| `brand_color` | VARCHAR | Hex Code เช่น `#FF5733` |
| `status` | ENUM | `active` / `hidden` |

#### Table 3: `events` — ข้อมูลงานแต่ละงาน
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `event_id` | PK | — |
| `sponsor_id` | FK → sponsors | เจ้าของงาน |
| `event_name` / `event_location` / `event_city` | VARCHAR | — |
| `event_type` | ENUM | `run` / `triathlon` / `other` |
| `organizer_name` | VARCHAR | อาจต่างจาก Sponsor |
| `start_date` / `end_date` | DATE | รองรับงานหลายวัน |
| `is_public` | BOOLEAN | `true` = แสดงใน Upcoming Events |
| `has_participant_import` | BOOLEAN | มีไฟล์ Import หรือไม่ |
| `status` | ENUM | `draft` → `published` → `active` → `closed` → `archived` |

#### Table 4: `stations` — จุดให้บริการในงาน
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `station_id` | PK | — |
| `event_id` | FK → events | — |
| `station_type` | ENUM | `air_recovery` / `ice_bath` / `other` |
| `station_name` | VARCHAR | ชื่อแสดงผล |
| `stamp_on_add_friend` | BOOLEAN | ได้ Stamp เมื่อ Add Friend LINE OA |
| `status` | ENUM | `active` / `hidden` |

#### Table 5: `athletes` — ข้อมูลส่วนตัวนักกีฬา
| Field | Type | MVP | หมายเหตุ |
|-------|------|-----|---------|
| `athlete_id` | PK | ✓ | — |
| `first_name` / `last_name` | VARCHAR | ✓ | required |
| `date_of_birth` | DATE | ✓ | คำนวณ Age Group on-the-fly |
| `gender` | ENUM | ✓ | `male` / `female` / `other` |
| `line_user_id` | VARCHAR | ✓ | null ถ้ายังไม่ Add Friend |
| `phone_number` | VARCHAR | ◷ | ยังไม่ใช้ใน MVP |
| `address_*` (7 fields) | VARCHAR | ◷ | ยังไม่ใช้ใน MVP |
| `status` | ENUM | ✓ | `active` / `hidden` |

#### Table 6: `athlete_event_registrations` — การลงทะเบียนต่องาน
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `registration_id` | PK | — |
| `athlete_id` | FK → athletes | null ได้ ถ้า Import มาก่อน Add Friend |
| `event_id` | FK → events | — |
| `bib_number` | VARCHAR | **Unique ต่อ event** |
| `profile_image_url` | VARCHAR | รูปจาก Import หรือ LINE Profile |
| `registered_at` | TIMESTAMP | — |
| `status` | ENUM | `active` / `hidden` |

> **Unique Constraint:** `bib_number + event_id`

#### Table 7: `checkins` — บันทึกการเข้าใช้บริการ
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `checkin_id` | PK | — |
| `athlete_id` | FK → athletes | ต้องมีค่า (บันทึกเฉพาะที่ลงทะเบียนแล้ว) |
| `station_id` | FK → stations | Staff เลือกจาก Dropdown |
| `event_id` | FK → events | — |
| `bib_number` | VARCHAR | เก็บไว้เป็น Reference |
| `checked_in_at` | TIMESTAMP | — |
| `is_new_athlete` | BOOLEAN | `true` = ลงทะเบียนวันนี้เป็นครั้งแรก |
| `is_duplicate` | BOOLEAN | `true` = กลับมาซ้ำในงานเดิม |

#### Table 8: `stamps` — Stamp ที่ออกจริง
| Field | Type | หมายเหตุ |
|-------|------|---------|
| `stamp_id` | PK | — |
| `athlete_id` | FK → athletes | — |
| `event_id` | FK → events | — |
| `station_id` | FK → stations | null ถ้าได้จาก Add Friend |
| `sponsor_id` | FK → sponsors | Stamp ของ Sponsor ไหน |
| `stamp_source` | ENUM | `check_in` / `add_friend` |
| `stamped_at` | TIMESTAMP | — |

---

### Tables POST-MVP (9–24) — สร้างไว้แต่ยังไม่พัฒนา Feature

| # | Table | วัตถุประสงค์ |
|---|-------|------------|
| 9 | `subscription_tiers` | โครงสร้าง Tier (ปัจจุบันทุก Sponsor ใช้ Level 1) |
| 10 | `event_sponsors` | Stamp Configuration ต่อ Sponsor ต่องาน |
| 11 | `notification_preferences` | การตั้งค่า Notification ของนักกีฬา |
| 12 | `athlete_sponsors` | ความสัมพันธ์นักกีฬากับ Sponsor |
| 13 | `rewards` | Reward เมื่อสะสม Stamp ครบ Milestone |
| 14 | `sponsor_blacklists` | Blacklist ระดับ Sponsor |
| 15 | `staff_event_assignments` | กำหนดงานที่ Staff ดูแล |
| 16 | `notification_logs` | ประวัติ Notification |
| 17 | `audit_logs` | บันทึกทุก Action |
| 18 | `assets` | ชุดอุปกรณ์ทางกายภาพของ MACIM |
| 19 | `asset_bookings` | การจอง Asset สำหรับงาน |
| 20 | `reward_milestones` | Milestone และของรางวัล |
| 21 | `system_settings` | ค่า Default ของระบบ |
| 22 | `sponsor_settings` | การตั้งค่าของแต่ละ Sponsor |
| 23 | `sponsor_consent_templates` | Privacy Policy / PDPA |
| 24 | `message_templates` | Template ข้อความ |

---

## 4. Role & Permission

| Role | ฝ่าย | สิทธิ์ |
|------|------|--------|
| `super_admin_owner` | MACIM | สูงสุด — ทำได้ทุกอย่าง รวมถึงจัดการ User ทุก Role |
| `super_admin_manager` | MACIM | ทำงานรายวัน — สร้าง/แก้ไขได้ทุกอย่าง ดู Report ทุก Sponsor |
| `super_admin_viewer` | MACIM | ดูอย่างเดียว — ดู Report ทุก Sponsor ไม่แก้ไข |
| `sponsor_admin` | Sponsor | เห็นเฉพาะข้อมูล Sponsor ตัวเอง |
| `sponsor_staff` | Sponsor | เข้าได้เฉพาะหน้า Check-in บน Tablet |

---

## 5. MVP Workflow

### 5.1 ก่อนวันงาน — MACIM Setup (5 ขั้นตอน)

```
1. สร้าง Sponsor (is_internal = true สำหรับ 2 งานแรก)
2. สร้าง Event (status = draft, is_public = false)
3. Import ไฟล์รายชื่อนักกีฬา CSV/Excel (ถ้ามี)
   → บันทึกลง athlete_event_registrations
4. สร้าง Station (ระบุประเภท ชื่อ stamp_on_add_friend)
5. เปิดเผยงาน (status = published, is_public = true)
```

### 5.2 ก่อนวันงาน — นักกีฬา Pre-register (ไม่บังคับ)

```
สแกน QR Code → Add Friend LINE OA
→ กด "เข้าร่วมกิจกรรม"
→ กรอก ชื่อ / นามสกุล / วันเกิด / เพศ / BIB Number
→ ยืนยัน PDPA
→ ระบบสร้าง Profile และผูกกับ Event

⚠ ถ้า Import + Pre-register มี BIB เดียวกัน → Merge อัตโนมัติ ไม่สร้างซ้ำ
```

### 5.3 วันงาน — Check-in ที่ Station

Staff เลือก Station จาก Dropdown ใน Tablet ก่อน แล้วดำเนินการตาม 3 กรณี:

#### กรณีที่ 1: พบข้อมูลในระบบ
```
Staff กรอก BIB → พบข้อมูล → แสดงชื่อ + รูป (Import > LINE Profile > Avatar)
→ นักกีฬายืนยัน
→ บันทึก checkin
  - ครั้งแรกของงาน → ออก Stamp ทันที
  - ซ้ำในงานเดิม → บันทึก is_duplicate = true, ไม่ได้ Stamp
→ แจ้งผลภายใน 3 วินาที
```

#### กรณีที่ 2: ไม่พบข้อมูล
```
Staff กรอก BIB → ไม่พบ → อนุญาตเข้าใช้บริการได้เลย
→ ไม่บันทึก checkin
→ แจ้งว่า "สมัคร LINE OA ทีหลัง จะได้สะสม Stamp ครั้งต่อไป"
```

#### กรณีที่ 3: นักกีฬาอยากลงทะเบียนทันที
```
Tablet แสดง QR Code LINE OA
→ นักกีฬาสแกน Add Friend → กรอกข้อมูลในโทรศัพท์ตัวเอง
→ ลงทะเบียนสำเร็จ → Check-in → ได้ Stamp ทันที
```

### 5.4 Stamp Rule (MVP)
| Rule | ค่า | ความหมาย |
|------|-----|---------|
| `stamp_scope` | `per_event` | นับรวมต่องาน ไม่แยกต่อ Station |
| `stamp_rule` | `first_only` | ได้ Stamp เฉพาะครั้งแรกของงานนั้น |
| `stamp_on_add_friend` | เปิด/ปิดได้ | ได้ Stamp เพิ่มเมื่อ Add Friend LINE OA |

### 5.5 QR Code ใน MVP
- มีเพียงประเภทเดียว: **QR ของ LINE OA** (Add Friend + เริ่ม Registration)
- เป็น QR ถาวร ไม่มีวันหมดอายุ ไม่ผูกกับ Event ใด
- **ไม่มี QR ที่ Station** — Staff เลือก Station จาก Dropdown แทน

---

## 6. Feature POST-MVP (ยังไม่พัฒนา)

| Feature | รายละเอียด |
|---------|-----------|
| Reward Milestone | ออก Reward เมื่อสะสม Stamp ครบ Milestone |
| Sponsor Dashboard | ROI Report, Age Group, Check-in Stats |
| Asset Management | จัดการชุดอุปกรณ์และระบบจอง |
| Message Templates | ข้อความอัตโนมัติในแต่ละ trigger_point |
| Blacklist | Sponsor Blacklist นักกีฬาระดับ Sponsor |
| Event Cancellation Flow | ยกเลิก Event ต้องทั้งสองฝ่ายกดรับรู้ |
| OTP Login | สำหรับนักกีฬาที่ไม่มี LINE (เบอร์โทร + OTP) |
| Notification System | ส่งผ่าน LINE OA ไปหานักกีฬาและ Admin |
| Privacy Policy / PDPA | รอทนายช่วยร่าง |

---

## 7. สัญลักษณ์ในเอกสาร
| สัญลักษณ์ | ความหมาย |
|----------|---------|
| ✓ MVP | พัฒนา Feature และใช้งานใน Phase แรก |
| ◷ POST-MVP | สร้าง Table ไว้ใน Database แต่ยังไม่พัฒนา Feature |
