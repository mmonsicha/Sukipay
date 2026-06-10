# SukiPay — Demo Cases: Transaction Cancellation & Refund Flow

> **Last updated:** 2026-06-10  
> **Scope:** Transaction Detail Page — ยกเลิกออเดอร์, คืนเงิน, Overpay

---

## Overview

ทุก transaction ที่มีสถานะ **CLOSED** หรือ **SETTLED** และมี payment COMPLETED จะมีปุ่ม **"ยกเลิกออเดอร์"** ที่ header  
Flow ที่เปิดขึ้นมาจะต่างกันตาม payment channel และสถานะ settlement ดังนี้:

| Case | Payment Channel | Transaction Status | Dialog | การคืนเงิน |
|------|----------------|-------------------|--------|------------|
| 1 | CASH | CLOSED (ยังไม่ปิดยอด) | VoidDialog | เงินสดหน้าร้าน (face-to-face) |
| 2 | CASH | SETTLED (ปิดยอดแล้ว) | RefundDialog (cancel mode) | โอนผ่านธนาคาร |
| 3 | BANK_TRANSFER | CLOSED หรือ SETTLED | RefundDialog (cancel mode) | โอนผ่านธนาคาร (pre-fill จาก slip) |
| 4 | Any | CLOSED + overpay_delta > 0 | OverpayBanner | โอนผ่านธนาคาร หรือ บันทึกเป็น Tip |

---

## Case 1 — เงินสด ยังไม่ปิดยอด

**Transaction:** `TXN-20260609-CVDEMO`  
**สถานะ:** `CLOSED` + Payment `CASH` ฿1,500  
**Entry point:** ปุ่ม "ยกเลิกออเดอร์" ใน header (เปิด VoidDialog)

### Flow
1. กดปุ่ม **"ยกเลิกออเดอร์"** (header ขวา)
2. **VoidDialog** เปิด: เลือกเหตุผลในการยกเลิก
3. เหตุผลบางตัวต้องกาช่อง **"ยืนยันว่าได้คืนเงินสด ฿1,500 ให้ลูกค้าแล้ว"** ก่อนยืนยัน
4. กด **"ยืนยัน"** → Transaction status เปลี่ยนเป็น VOID_PREPARED → VOID
5. Toast แจ้ง "ยกเลิกการชำระสำเร็จ"

### เหตุผลที่ต้องกาช่อง
- ลูกค้าขอยกเลิกออเดอร์
- ชำระซ้ำโดยไม่ตั้งใจ
- ลูกค้าปฏิเสธรับสินค้า
- ยอดเงินไม่ถูกต้อง
- อื่นๆ

### เหตุผลที่ **ไม่ต้อง** กาช่อง
- บันทึกการชำระผิดพลาด / ไม่มีการรับเงินจริง

---

## Case 2 — เงินสด ปิดยอดแล้ว

**Transaction:** `TXN-20260608-STLCASH`  
**สถานะ:** `SETTLED` + Payment `CASH` ฿2,800  
**Entry point:** ปุ่ม "ยกเลิกออเดอร์" ใน header (เปิด RefundDialog)

### Flow
1. กดปุ่ม **"ยกเลิกออเดอร์"** (header ขวา)
2. **RefundDialog** เปิดพร้อม title "ยกเลิกออเดอร์ / คืนเงิน"
3. เลือก **เหตุผลในการยกเลิก** (บังคับ)
4. เลือก payment ที่จะคืน (รายการที่ 1 — เงินสด · คืนผ่านโอนธนาคาร)
5. กรอก **ยอด**, **ชื่อบัญชีปลายทาง**, **ธนาคาร**, **เลขบัญชี**
6. กด **"ยืนยันคืนเงิน"** → ระบบส่งคำขอโอนเงิน
7. Toast แจ้ง "ส่งคำขอคืนเงิน ฿X,XXX สำเร็จ"

> ⚠️ ไม่มี bank info pre-fill เพราะ CASH ไม่มี slip — Finance Manager ต้องกรอกบัญชีลูกค้าเอง

---

## Case 3a — Bank Transfer ยังไม่ปิดยอด

**Transaction:** `TXN-20260609-CLSBT`  
**สถานะ:** `CLOSED` + Payment `BANK_TRANSFER` ฿4,200 (SCB)  
**Entry point:** ปุ่ม "ยกเลิกออเดอร์" ใน header (เปิด RefundDialog)

### Flow
1. กดปุ่ม **"ยกเลิกออเดอร์"** (header ขวา)
2. **RefundDialog** เปิดพร้อม title "ยกเลิกออเดอร์ / คืนเงิน"
3. เลือก **เหตุผลในการยกเลิก** (บังคับ)
4. เลือก payment (รายการที่ 1 — โอนผ่านธนาคาร · SCB)
5. ยอด pre-fill = ฿4,200, เลขบัญชีปลายทาง pre-fill จาก slip
6. กรอก **ชื่อบัญชีปลายทาง** (ไม่ pre-fill เพราะ slip ไม่มีชื่อเจ้าของบัญชีผู้โอน)
7. กด **"ยืนยันคืนเงิน"**

---

## Case 3b — Bank Transfer ปิดยอดแล้ว

**Transaction:** `TXN-20260401-STLDEMO`  
**สถานะ:** `SETTLED` + Payment `BANK_TRANSFER` ฿8,500 (KBANK)  
**Entry point:** ปุ่ม "ยกเลิกออเดอร์" ใน header (เปิด RefundDialog)

### Flow
เหมือน Case 3a ทุกประการ — ต่างกันเพียง transaction status เป็น SETTLED

---

## Case 4 — ชำระเกิน (Overpay)

**Transaction:** `TXN-20260610-FOVPDEMO`  
**สถานะ:** `CLOSED` + Payment `BANK_TRANSFER` ฿3,550 (ยอดสั่งซื้อ ฿3,200, เกิน ฿350)  
**Entry point:** Banner "ชำระเกิน" ที่ด้านบนของ Transaction Detail

### Flow — ตัวเลือก A: คืนเงิน
1. Banner แสดง: "ชำระเกิน ฿350 — ยอดที่ต้องคืน ฿350"
2. กดปุ่ม **"คืนเงิน"** บน Banner
3. **RefundDialog** เปิด: **ไม่มี reason selector** (เหตุผลชัดเจนอยู่แล้ว)
4. เลือก payment → กรอกบัญชีปลายทาง → กด **"ยืนยันคืนเงิน ฿350"**
5. Banner เปลี่ยนเป็น "คืนเงินครบแล้ว"

### Flow — ตัวเลือก B: บันทึกเป็น Tip
1. กดปุ่ม **"ถือเป็น Tip"** บน Banner (หรือใน RefundDialog)
2. **TipConfirmDialog** เปิด: แสดงยอด ฿350 พร้อม confirm
3. กด **"ยืนยัน"** → Banner หาย → audit trail บันทึก "ถือเป็น Tip"

> ℹ️ Overpay flow เป็น **แยกต่างหาก** จากปุ่ม "ยกเลิกออเดอร์" — เป็นการจัดการยอดส่วนเกินโดยไม่ยกเลิก order

---

## สรุป Demo Transaction ทั้งหมด

| # | Transaction No | Channel | Status | Amount | Demo เพื่อ |
|---|---------------|---------|--------|--------|-----------|
| 1 | `TXN-20260609-CVDEMO` | CASH | CLOSED | ฿1,500 | Case 1: คืนสดหน้าร้าน |
| 2 | `TXN-20260608-STLCASH` | CASH | SETTLED | ฿2,800 | Case 2: คืนโอนธนาคาร (CASH หลังปิดยอด) |
| 3 | `TXN-20260609-CLSBT` | BANK_TRANSFER | CLOSED | ฿4,200 | Case 3a: คืนโอนธนาคาร (ก่อนปิดยอด) |
| 4 | `TXN-20260401-STLDEMO` | BANK_TRANSFER | SETTLED | ฿8,500 | Case 3b: คืนโอนธนาคาร (หลังปิดยอด) |
| 5 | `TXN-20260610-FOVPDEMO` | BANK_TRANSFER | CLOSED | ฿3,550 (เกิน ฿350) | Case 4: Overpay → คืน/Tip (fresh) |
| 6 | `TXN-20260610-OVPDEMO` | BANK_TRANSFER | CLOSED | ฿12,500 (เกิน ฿500) | Case 4: Overpay → คืน partial (มีประวัติ ฿300 แล้ว) |

---

## Business Rules สรุป

```
ยกเลิกออเดอร์ (Header button)
├── CLOSED + all CASH     → VoidDialog  → คืนสด face-to-face
├── CLOSED + BANK_TRANSFER → RefundDialog (cancel) → คืนโอนธนาคาร
├── SETTLED + CASH        → RefundDialog (cancel) → คืนโอนธนาคาร
└── SETTLED + BANK_TRANSFER → RefundDialog (cancel) → คืนโอนธนาคาร

Overpay (OverpayBanner — แยกต่างหาก)
├── กด "คืนเงิน"   → RefundDialog (overpay mode) → คืนโอนธนาคาร
└── กด "ถือเป็นTip" → TipConfirmDialog → บันทึก Tip
```
