# MACIM SPORT — Permission Design

> ยืนยันแล้วจากการปรึกษา

---

## Role Summary

| Role | คือใคร | ใช้งานยังไง |
|------|--------|------------|
| `super_admin_owner` | เจ้าของ/ผู้บริหาร | Emergency only — ไม่มี UI พิเศษ ใช้หน้าเดียวกับ Manager |
| `super_admin_manager` | ผู้จัดการ MACIM | ทำงานรายวัน — สร้าง/แก้ไขทุกอย่าง |
| `super_admin_viewer` | ทีมงาน MACIM | ดู Report อย่างเดียว |
| `sponsor_admin` | ผู้ดูแลฝั่ง Sponsor | จัดการข้อมูล Sponsor ตัวเอง + สร้าง Staff |
| `sponsor_staff` | Staff หน้างาน | เข้าได้แค่หน้า Check-in บน Tablet |

---

## สิ่งที่แต่ละ Role ทำได้

### super_admin_owner + super_admin_manager (UI เดียวกัน)

**Sponsor Management**
- สร้าง / แก้ไข Sponsor
- สร้าง Account `sponsor_admin` (ต้องระบุ Sponsor)

**Event Management**
- สร้าง / แก้ไข Event
- เปลี่ยน Event status (`draft → published → active → closed → archived`)
- เปิด/ปิด `is_public`
- Import ไฟล์รายชื่อนักกีฬา (CSV/Excel)

**Station Management**
- สร้าง / แก้ไข Station
- ตั้งค่า `stamp_on_add_friend`

**User Management**
- สร้าง / แก้ไข / disable User ทุก Role
- *Owner เท่านั้น:* แก้ไข super_admin ด้วยกัน

**Report**
- ดู Report และ Check-in stats ของทุก Sponsor

> **ข้อต่าง Owner vs Manager:** Manager ไม่สามารถแก้ไข super_admin ระดับใดได้

---

### super_admin_viewer

- ดู Report และ Check-in stats ของทุก Sponsor
- **ไม่เห็น** Master Data (Sponsor, Event, Station, User)
- **ไม่สร้าง / แก้ไข** อะไรได้เลย

---

### sponsor_admin

**ขอบเขต: เฉพาะ Sponsor ตัวเองเท่านั้น**

- ดูข้อมูล Event ที่ Sponsor ตัวเองเข้าร่วม
- ดูรายชื่อนักกีฬาของ Sponsor ตัวเอง
- ดู Report ของ Sponsor ตัวเอง
- **สร้าง `sponsor_staff`** — auto-lock ไว้ที่ Sponsor ตัวเอง ไม่ต้องเลือก Sponsor
- แก้ไข / disable `sponsor_staff` ของตัวเอง

---

### sponsor_staff

- เข้าได้ **เฉพาะหน้า Check-in** บน Tablet
- ค้นหา BIB Number
- บันทึก Check-in
- ไม่เห็นข้อมูลอื่นใดเลย

---

## User Creation Matrix

| ผู้สร้าง | Role ที่สร้างได้ | Sponsor field |
|---------|----------------|---------------|
| Owner | ทุก Role | เลือกได้ทุก Sponsor |
| Manager | `sponsor_admin`, `sponsor_staff`, `super_admin_viewer` | เลือกได้ทุก Sponsor |
| sponsor_admin | `sponsor_staff` เท่านั้น | Fixed = Sponsor ตัวเอง (ไม่แสดง dropdown) |

---

## Route Protection

```
/dashboard/*                → ต้อง login (ทุก Role ยกเว้น sponsor_staff)
/dashboard/report/*         → super_admin_* ทุก Role + sponsor_admin (own only)
/dashboard/sponsors/*       → owner + manager เท่านั้น
/dashboard/events/*         → owner + manager เท่านั้น
/dashboard/users/*          → owner + manager + sponsor_admin (scoped)
/checkin/*                  → sponsor_staff (และ Role อื่นที่ต้องการดู)
```
