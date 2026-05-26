# UX Critique Report — SukiPay Transaction Module
**URL:** https://sukipay.vercel.app/transactions  
**Date:** 26 May 2026  
**Evaluator Persona:** ผู้จัดการการเงิน (Finance Manager) — ผู้ใช้ใหม่ที่เพิ่งเข้ามาดูแลระบบ  
**Method:** Heuristic Evaluation (Nielsen's 10 Heuristics) + Role-play Usability Walkthrough  
**Scope:** Transaction List Page + Transaction Detail Page

---

## Persona & Goal

> **ชื่อ:** ผู้จัดการ (Finance Manager)  
> **Background:** เพิ่งเข้ามาดูแลระบบ ยังไม่คุ้นชินกับ workflow ของ SukiPay  
> **เป้าหมายหลัก:**  
> 1. ตรวจสอบรายการธุรกรรมรายวัน / รายเดือน  
> 2. ตรวจสอบสถานะการชำระเงิน  
> 3. อัปเดตข้อมูลของแคชเชียร์หน้าร้าน (Seller) เพื่อ Approve ในขั้นตอนถัดไป

---

## Overall Impression

ระบบมีโครงสร้าง UI ที่สะอาดตา ข้อมูลครบถ้วน และ Feature ค่อนข้างหลากหลาย แต่สำหรับ **Finance Manager มือใหม่** ยังมีช่องว่างสำคัญ: **ไม่มีปุ่ม Approve ที่ชัดเจนในหน้า Transaction Detail** ทำให้ goal หลักของ persona ไม่สำเร็จ นอกจากนี้ยังมีความกำกวมระหว่าง "สถานะการชำระเงิน" และ "สถานะธุรกรรม" ที่อาจทำให้ผู้ใช้ใหม่สับสน

---

## 1. Process Understanding — Walkthrough as Finance Manager

### Step 1: เข้าสู่หน้า `/transactions`

เมื่อเข้ามาครั้งแรก Finance Manager เห็น:
- Tabs: **ทั้งหมด | รอชำระ | รอตรวจสอบ | สำเร็จ | ยกเลิก**
- ตารางข้อมูลกว้าง 11 คอลัมน์
- ปุ่ม Action สองปุ่มในแต่ละแถว

**ความเข้าใจเบื้องต้น:** Tab "รอตรวจสอบ" (UNDER_REVIEW) บ่งชี้ชัดว่านี่คือรายการที่ต้องดำเนินการ และตรงกับ mental model ของ Finance Manager ✅  

แต่เมื่อคลิกเข้า Tab "รอตรวจสอบ" ผู้ใช้ต้องเข้าใจเองว่า "ตรวจสอบ" คืออะไร เพราะไม่มีคำอธิบาย/tooltip ว่า Flow คืออะไร ❌

### Step 2: กดปุ่ม "ตรวจสอบ" ในตาราง

ปุ่ม "ตรวจสอบ" (primary brand button) นำไปสู่หน้า Transaction Detail ซึ่งมี:
- ข้อมูลการชำระเงิน (Payment Card)
- สลิป (Slip thumbnail + ดูสลิป)
- Audit Trail
- Timeline สถานะ

**ปัญหาหลัก:** ไม่มีปุ่ม **"อนุมัติ" (Approve) หรือ "ปฏิเสธ" (Reject)** ในหน้านี้  
Finance Manager ที่กดเข้ามาด้วยความตั้งใจจะ approve จะหาปุ่มไม่เจอ — นี่คือ **Critical Blocker** สำหรับ Goal ของ Persona ❌

### Step 3: ตรวจสอบรายการรายวัน/รายเดือน

Finance Manager ต้องการกรองวันที่ — ระบบมี date preset (วันนี้, เมื่อวาน, 7 วัน, 30 วัน, เดือนนี้) ✅  
แต่ไม่มี preset "เดือนที่แล้ว" หรือ "ไตรมาสนี้" ซึ่ง Finance Manager มักต้องการ ❌

### Step 4: อัปเดตข้อมูล Seller / Cashier

ใน Transaction Detail ด้านขวา sidebar มี **"ข้อมูลลูกค้า"** แต่ไม่มี **"ข้อมูลผู้ขาย/แคชเชียร์"** (Seller info section)  
Finance Manager ไม่พบที่อัปเดตข้อมูล Seller ในระบบนี้เลย ❌

---

## 2. UX Analysis — Feature by Feature

### 2.1 Status Tabs

| ประเด็น | ประเมิน |
|--------|---------|
| Tab labels ภาษาไทยชัดเจน | ✅ ดี |
| มี count badge บน tab | ✅ ดี |
| **Bug: Tab count ไม่ตรงกับจำนวนจริง** | ❌ ปัญหา |
| ไม่มี tooltip อธิบายความหมายของแต่ละ tab | ⚠️ ควรปรับปรุง |

**Bug รายละเอียด:**  
`StatusTabs.tsx` นับ count ด้วย logic ต่างจาก `matchesTab()` ใน `TransactionPage.tsx`:
- Tab **สำเร็จ**: StatusTabs นับ `COMPLETED || CLOSED` แต่ matchesTab กรองด้วย `(CLOSED || SETTLED) && payment_status === COMPLETED`
- Tab **ยกเลิก**: StatusTabs นับ `CANCELLED || FAILED || EXPIRED` แต่ matchesTab กรองเฉพาะ `CANCELLED`

ผลลัพธ์: ตัวเลขบน tab ไม่ตรงกับจำนวนแถวในตาราง ทำให้ผู้ใช้สับสน

**Recommendation:** แก้ให้ logic เดียวกัน หรือดึง count จาก `filtered` ที่ผ่าน matchesTab() แล้ว

---

### 2.2 Search & Filter Bar

| ประเด็น | ประเมิน |
|--------|---------|
| Date preset dropdown ใช้งานง่าย | ✅ ดี |
| Filter badge count บอก active filters | ✅ ดี |
| ปุ่ม "ล้างทั้งหมด" เห็นชัดเมื่อมี filter | ✅ ดี |
| **Search ค้นได้แค่ TxNo / OrderNo เท่านั้น** | ❌ จำกัดเกินไป |
| Placeholder ไม่กล่าวถึง Order No เลย | ⚠️ Misleading |
| ไม่มี preset "เดือนที่แล้ว" | ⚠️ ขาดสำหรับ Finance |
| Date type switching อัตโนมัติ (ไม่แจ้งผู้ใช้) | ⚠️ ควรแสดง feedback |

**Recommendation:**
- เพิ่ม search ด้วยชื่อลูกค้า / ร้านค้า
- แก้ placeholder: `"ค้นหา Transaction No หรือ Order No..."`
- เพิ่ม date preset: เดือนที่แล้ว, 3 เดือนล่าสุด
- เมื่อ tab เปลี่ยน date type อัตโนมัติ ให้แสดง tooltip หรือ inline label บอกว่ากำลังกรองโดย "วันที่ส่ง Slip"

---

### 2.3 Transaction Table

| ประเด็น | ประเมิน |
|--------|---------|
| Expandable rows สำหรับ multi-payment | ✅ ดี |
| Slip thumbnail ในตาราง | ✅ ดี — ประหยัดเวลาตรวจ |
| Real-time polling + banner แจ้งรายการใหม่ | ✅ ดี |
| Amount แสดงทั้งยอดรวมและ "คงเหลือ" | ✅ ดี |
| **มีสองคอลัมน์สถานะ (Payment + Transaction)** | ⚠️ Cognitive Load สูง |
| Expand button อยู่ในคอลัมน์แรกไม่มี label | ⚠️ Discoverability ต่ำ |
| "ช่องทางการชำระเงิน" แสดง "ไม่ระบุ" สำหรับ PENDING | ⚠️ อาจสร้างความสับสน |
| Action buttons ไม่ consistent (บางแถวมี 1, บางแถวมี 2) | ⚠️ ตามสถานะ — ยอมรับได้แต่ควร align ขวาเสมอ |
| Transaction No truncate ที่ 22 ตัวอักษร + "…" | ✅ ดี |

**เรื่องสองคอลัมน์สถานะ:**  
สำหรับ Finance Manager มือใหม่ ความแตกต่างระหว่าง "สถานะการชำระเงิน" กับ "สถานะธุรกรรม" ไม่ชัดเจน เช่น:
- Payment: "รอตรวจสอบ" + Transaction: "รอดำเนินการ" — ต่างกันอย่างไร?  

**Recommendation:** เพิ่ม tooltip หรือ info icon อธิบายความหมายของแต่ละสถานะ หรือรวมเป็น "สถานะ" คอลัมน์เดียวโดยแสดง combined status badge

---

### 2.4 Transaction Detail Page

| ประเด็น | ประเมิน |
|--------|---------|
| Back button ชัดเจน | ✅ ดี |
| Header card แสดง Tx No + Amount + Status | ✅ ดี |
| Payment Card แสดงข้อมูลครบ | ✅ ดี |
| Slip thumbnail + ดูสลิปในหน้า detail | ✅ ดี |
| Payment Summary (ยอดรวม / ชำระแล้ว / คงเหลือ) | ✅ ดี มาก |
| Timeline สถานะ (Vertical Timeline) | ✅ ดี |
| Audit Trail ตาราง | ✅ ดี |
| **ไม่มีปุ่ม Approve / Reject** | ❌ Critical — Missing Core Action |
| **ไม่มีข้อมูล Seller / Cashier** | ❌ Missing for Finance Goal |
| Breadcrumb ไม่มี (มีแค่ปุ่ม back) | ⚠️ ขาด context ว่าอยู่ที่ไหน |
| Per-payment audit trail ซ้อนอยู่ใน accordion ต้องคลิกเปิด | ⚠️ Discoverability ต่ำ |
| หน้า 404 (not found) มี emoji 🔍 และ message ชัดเจน | ✅ ดี |

---

### 2.5 Real-time Polling

| ประเด็น | ประเมิน |
|--------|---------|
| Banner "มีรายการใหม่" แสดงเมื่อ scroll ลง | ✅ ดี |
| Dismiss banner ได้ | ✅ ดี |
| Flash highlight แถวใหม่ 1.5 วินาที | ✅ ดี |
| หยุด poll เมื่อ tab ไม่ active (visibility API) | ✅ ดี — ประหยัด resource |
| **Poll ทุก 8 วินาที อาจมากเกินในช่วงที่ผู้ใช้ไม่ได้ดู** | ⚠️ Production ควร 30s |
| ไม่มี indicator แสดงว่า "กำลัง sync" ขณะ poll | ⚠️ ผู้ใช้ไม่รู้ว่าข้อมูล fresh แค่ไหน |

---

## 3. UI Overview — Transaction Detail Page

```
┌──────────────────────────────────────────────────────────────┐
│ [← รายการธุรกรรม]                                            │
├──────────────────────────────────────────────────────────────┤
│ TXN-20260505-X7K2M9           [สถานะ Badge]  ฿12,500.00     │
│ วันที่ทำรายการ: 05/05/2026 10:30:00                          │
│ Order: SC-202605-00042                                       │
├──────────────────┬───────────────────────────────────────────┤
│  MAIN (LEFT)     │  SIDEBAR (RIGHT)                          │
│                  │                                           │
│  รายการชำระเงิน │  ข้อมูลลูกค้า                            │
│  ┌─────────────┐ │  - ชื่อลูกค้า                            │
│  │ Payment     │ │  - ช่องทางติดต่อ                         │
│  │ Card #1     │ │  - ร้านค้า / บริษัท                      │
│  └─────────────┘ │                                           │
│                  │  สรุปยอดชำระ                             │
│  ประวัติการ      │  - ยอดรวม / ชำระแล้ว / คงเหลือ          │
│  ดำเนินการ       │                                           │
│  [Audit Table]   │  สถานะไทม์ไลน์                           │
│                  │  [Vertical Timeline]                      │
└──────────────────┴───────────────────────────────────────────┘
```

**สิ่งที่ดี:**
- Layout 2-column (main + sidebar) เหมาะกับ information density
- Payment Summary widget สรุปยอดสำคัญได้ดีมาก
- Audit trail ช่วยให้ Finance Manager ตรวจสอบประวัติได้ครบ
- Vertical Timeline แสดงการเปลี่ยนสถานะตามลำดับเวลาชัดเจน

**สิ่งที่ขาด/ควรปรับปรุง:**
- ❌ **ไม่มี Action Zone** — ปุ่ม Approve/Reject/Request Info ควรอยู่ใน sticky header หรือ top-right ของ Payment Card
- ❌ **ไม่มี Seller Info** — ควรเพิ่ม section แสดงข้อมูล Cashier/Seller ที่ส่งสลิป
- ⚠️ **Back button ไม่แสดง current page context** — ควรเป็น breadcrumb: `รายการธุรกรรม > TXN-20260505-X7K2M9`
- ⚠️ **Per-payment audit trail ซ่อนอยู่ใน accordion** — Finance Manager ที่ต้องการ audit อาจไม่รู้ว่ามีข้อมูลอยู่ใน accordion

---

## 4. Heuristic Evaluation Summary

| # | Heuristic | Rating | Notes |
|---|-----------|--------|-------|
| 1 | Visibility of system status | 🟡 Moderate | Tabs + badges ดี แต่ไม่มี "last updated" indicator |
| 2 | Match between system & real world | ✅ Good | ภาษาไทยตลอด, ชื่อ tab/status สอดคล้องกับ workflow |
| 3 | User control and freedom | 🟡 Moderate | มี undo filter แต่ไม่มี back state บน detail |
| 4 | Consistency and standards | 🟡 Moderate | Status badge ทั้งสองชุด (PS/TS) อาจ overlap สี |
| 5 | Error prevention | ⚠️ Weak | ไม่มี confirmation ก่อน action สำคัญ (Approve/Reject) |
| 6 | Recognition over recall | 🟡 Moderate | Status meaning ต้องจดจำ ไม่มี legend/tooltip |
| 7 | Flexibility and efficiency | 🟡 Moderate | Date presets ดี แต่ขาด preset สำหรับ finance reporting |
| 8 | Aesthetic and minimalist design | ✅ Good | Clean, ไม่รก, ข้อมูล dense แต่อ่านได้ |
| 9 | Help users recognize errors | 🟡 Moderate | Empty state ดี, แต่ tab count mismatch สร้าง confusion |
| 10 | Help and documentation | ❌ Weak | ไม่มี help text, tooltip, หรือ onboarding guide เลย |

---

## 5. Priority Recommendations

### 🔴 Critical (ต้องแก้ก่อน)

**1. เพิ่มปุ่ม Approve / Reject บนหน้า Transaction Detail**  
Finance Manager เข้ามาหน้านี้ด้วยเป้าหมายจะ approve แต่ไม่มีปุ่มให้กด  
**แนวทาง:** เพิ่ม Action Bar ด้านบน Payment Card ที่มีสถานะ UNDER_REVIEW พร้อมปุ่ม "อนุมัติ" (green) และ "ปฏิเสธ" (red outline) พร้อม modal confirm เหตุผล

**2. แก้ Tab Count Logic ให้ตรงกับ matchesTab()**  
Tab badge แสดงตัวเลขไม่ตรงกับจำนวนแถวที่กรองได้จริง  
**แนวทาง:** ให้ StatusTabs รับ count จาก `filtered` array ที่ผ่าน matchesTab() แล้ว หรือแชร์ logic เดียวกัน

---

### 🟡 Moderate (ควรแก้ใน sprint ถัดไป)

**3. เพิ่ม Seller / Cashier Information Section**  
ใน Transaction Detail ควรมี section แสดงชื่อ/ข้อมูล Cashier ที่ส่งสลิป เพื่อให้ Finance Manager ตรวจสอบได้

**4. รวม หรือ อธิบาย สองคอลัมน์สถานะ**  
เพิ่ม tooltip หรือ info icon อธิบายความต่างระหว่าง "สถานะการชำระเงิน" และ "สถานะธุรกรรม"  
หรือพิจารณา merge เป็น combined status badge เดียว

**5. Breadcrumb Navigation บนหน้า Detail**  
`รายการธุรกรรม > TXN-20260505-X7K2M9` แทนปุ่ม back เพียงอย่างเดียว

**6. แก้ Search Placeholder**  
จาก: `"ค้นหาด้วย Transaction No (เช่น TXN-20260505-X7K2M9 หรือ X7K2M9)"`  
เป็น: `"ค้นหา Transaction No หรือ Order No..."`

**7. เพิ่ม Date Preset สำหรับ Finance**  
เพิ่ม: เดือนที่แล้ว, ไตรมาสนี้, ปีนี้

---

### 🟢 Minor (Nice to have)

**8. แจ้งผู้ใช้เมื่อ Date Type เปลี่ยนอัตโนมัติ**  
เมื่อสลับ tab ทำให้ dateType เปลี่ยน ควรแสดง inline label เช่น "กรองโดย: วันที่ส่ง Slip" ข้าง date picker

**9. เพิ่ม "Last synced" indicator**  
แสดงเวลาล่าสุดที่ sync ข้อมูล เช่น "อัปเดตล่าสุด 2 วินาทีที่แล้ว" บน top navbar

**10. Tooltip อธิบาย Status Badge**  
Hover บน badge ให้แสดง tooltip อธิบายความหมาย เช่น "รอตรวจสอบ: แคชเชียร์ส่งสลิปแล้ว รอ Finance Manager ตรวจสอบ"

**11. Make Expand Column Discoverable**  
เพิ่ม column header หรือ tooltip บน expand button: "แสดงรายการย่อย"

---

## 6. What Works Well

- **Polling Architecture ดีมาก** — การแยก "pending new" banner กับการ inject rows อัตโนมัติเมื่ออยู่บนสุด เป็น pattern ที่ไม่กวนการใช้งาน
- **Payment Summary Widget** — การแสดง ยอดรวม / ชำระแล้ว / คงเหลือ เป็น widget แยกใน sidebar ช่วย Finance Manager เห็นสถานะการชำระครบถ้วนได้ทันที
- **Slip thumbnail ในตาราง** — ลดขั้นตอนการตรวจสอบ ไม่ต้องเข้า detail เพื่อดูว่ามีสลิปหรือไม่
- **Expandable rows สำหรับ multi-payment** — รองรับ use case ซับซ้อน (แบ่งจ่ายหลายรอบ) ได้ดี
- **Audit Trail ครบถ้วน** — มีทั้ง event level และ payment level ช่วย traceability
- **Empty State ที่ดี** — มี context-aware empty state ต่างกันระหว่าง "ไม่มีข้อมูล" กับ "กรองแล้วไม่พบ"
- **ภาษาไทยตลอดระบบ** — ตรง target user group และลด cognitive load

---

## 7. Severity Summary

| Severity | Count | รายการ |
|----------|-------|--------|
| 🔴 Critical | 2 | ไม่มีปุ่ม Approve/Reject, Tab count mismatch |
| 🟡 Moderate | 5 | ขาด Seller info, สองสถานะสับสน, breadcrumb, search placeholder, date presets |
| 🟢 Minor | 4 | Date type label, Last synced, Status tooltip, Expand discoverability |

---

*Report generated: 26 May 2026 | Evaluator: Finance Manager Persona (Roleplay) | Method: Heuristic Evaluation + Source Code Analysis*
