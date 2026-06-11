# รายงาน Modal การยกเลิก / คืนเงิน

> **อัปเดต:** 2026-06-11  
> ครอบคลุม SukiPay-initiated cancel + OMS-initiated cancel ทุก case

---

## สรุป: มีทั้งหมด **3 Modal Component** — 6 Trigger Case

| # | Modal Component | จำนวน Mode/Variant | Trigger จาก | ใช้กับ Case |
|---|---|---|---|---|
| 1 | `VoidDialog` | 2 variants | ปุ่ม "ยกเลิกออเดอร์" / Banner OMS | CLOSED + CASH ทั้งหมด |
| 2 | `RefundDialog` | 3 modes | ปุ่ม "ยกเลิกออเดอร์" / Banner OMS / OverpayBanner | BANK_TRANSFER, SETTLED, Overpay |
| 3 | `TipConfirmDialog` | 1 | ปุ่ม "ถือเป็น Tip" (OverpayBanner หรือใน RefundDialog) | Overpay เท่านั้น |

---

## Decision Tree: ปุ่มไหน → Modal อะไร

```
กดปุ่ม "ยกเลิกออเดอร์" (SukiPay-initiated)
├── CLOSED + ทุก payment เป็น CASH
│   └── ▶ Modal 1A: VoidDialog (SukiPay) — เลือกเหตุผล + tick ยืนยันเงินสด
└── มี BANK_TRANSFER หรือ สถานะ SETTLED
    └── ▶ Modal 2B: RefundDialog (Cancel, manual reason) — เลือกเหตุผล + ระบุบัญชี

Transaction ถูกยกเลิกโดย OMS (banner "ดำเนินการคืนเงิน")
├── ก่อนชำระ (PENDING → CANCELLED)
│   └── ไม่มี Modal — ดูรายละเอียดได้อย่างเดียว
├── หลังชำระ + ก่อน settled (CLOSED → CANCELLED) + CASH ทั้งหมด
│   └── ▶ Modal 1B: VoidDialog (OMS) — แสดงเหตุผลจาก OMS + tick ยืนยันเงินสด
├── หลังชำระ + ก่อน settled (CLOSED → CANCELLED) + BANK_TRANSFER
│   └── ▶ Modal 2C: RefundDialog (OMS cancel) — เหตุผลถูก pre-fill + ระบุบัญชี
└── หลังชำระ + หลัง settled (SETTLED → CANCELLED)
    └── ▶ Modal 2C: RefundDialog (OMS cancel) — เหตุผลถูก pre-fill + ระบุบัญชี

กดปุ่ม "คืนเงิน" / "ดำเนินการคืนเงิน" (Overpay)
├── กดปุ่ม "คืนเงิน" ใน OverpayBanner
│   └── ▶ Modal 2A: RefundDialog (Overpay) — จำนวนถูก pre-fill, ไม่ต้องเลือกเหตุผล
└── กดปุ่ม "ถือเป็น Tip" (ใน OverpayBanner หรือใน RefundDialog)
    └── ▶ Modal 3: TipConfirmDialog — confirm dialog เดียว
```

---

## Modal 1 — VoidDialog
**ไฟล์:** `src/components/transactions/VoidDialog.tsx`  
**ใช้เมื่อ:** CLOSED + ทุก payment เป็น CASH (คืนเงินสดหน้าร้าน ก่อน settlement)

### Variant A: SukiPay-initiated Cancel
**Trigger:** ปุ่ม "ยกเลิกออเดอร์" บนหน้า detail  
**URL ทดสอบ:** `/transactions/TXN-20260609-CVDEMO` → กดปุ่ม "ยกเลิกออเดอร์"

```
┌─────────────────────────────────────────────────┐
│  ยกเลิกการชำระ  TXN-20260609-CVDEMO             │
├─────────────────────────────────────────────────┤
│           จำนวนยอดคืน                           │
│             ฿1,500.00                            │
├─────────────────────────────────────────────────┤
│  เหตุผลในการยกเลิก *                            │
│  ○ บันทึกการชำระผิดพลาด / ไม่มีการรับเงินจริง  │
│  ○ ลูกค้าขอยกเลิกออร์เดอร์                     │  ← cashConfirm = true
│  ○ ชำระซ้ำโดยไม่ตั้งใจ                          │  ← cashConfirm = true
│  ○ ลูกค้าปฏิเสธรับสินค้า                        │  ← cashConfirm = true
│  ○ ยอดเงินไม่ถูกต้อง/ข้อมูลผิด                 │  ← cashConfirm = true
│  ○ อื่นๆ                                        │  ← cashConfirm = true
│                                                 │
│  [แสดงเมื่อเลือก reason ที่ cashConfirm = true] │
│  ☐ ยืนยันว่าได้คืนเงินสด ฿1,500.00 ให้ลูกค้า  │
├─────────────────────────────────────────────────┤
│        [ยกเลิก]         [ยืนยัน]               │
└─────────────────────────────────────────────────┘
```

**สิ่งที่เกิดขึ้นหลังยืนยัน:**  
`CLOSED → VOID_PREPARED` (ทันที) → `VOID_PREPARED → VOID` (หน่วง 1.2 วิ, async simulate)  
Payment status → `VOIDED`

---

### Variant B: OMS-cancelled (CLOSED + CASH)
**Trigger:** Banner "ถูกยกเลิกโดย OMS" → ปุ่ม "ดำเนินการคืนเงิน"  
**URL ทดสอบ:** `/transactions/TXN-20260610-OMSCASH` → กดปุ่ม "ดำเนินการคืนเงิน"

```
┌─────────────────────────────────────────────────┐
│  ยืนยันการคืนเงินสด  TXN-20260610-OMSCASH       │
│  ┌─────────────────────────────────────────┐   │
│  │ 🟠 ยกเลิกโดย OMS — เหตุผลถูกระบุมาแล้ว │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│           จำนวนยอดคืน                           │
│             ฿3,200.00                            │
├─────────────────────────────────────────────────┤
│  เหตุผลในการยกเลิก                              │
│  ┌─────────────────────────────────────────┐   │
│  │ ✅ สินค้าหมดสต็อก (พบทีหลัง)           │   │  ← pre-filled จาก OMS (สีเขียว)
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ☐ ยืนยันว่าได้คืนเงินสด ฿3,200.00 ให้ลูกค้า  │  ← บังคับเสมอใน OMS mode
├─────────────────────────────────────────────────┤
│        [ยกเลิก]         [ยืนยัน]               │
└─────────────────────────────────────────────────┘
```

**สิ่งที่เกิดขึ้นหลังยืนยัน:**  
Payment status → `VOIDED` ทันที (ไม่ผ่าน VOID_PREPARED เพราะ tx เป็น CANCELLED อยู่แล้ว)  
Toast: "ยืนยันการคืนเงินสดเรียบร้อย"

---

## Modal 2 — RefundDialog
**ไฟล์:** `src/components/transactions/RefundDialog.tsx`  
**ใช้เมื่อ:** ต้องโอนเงินคืนผ่านธนาคาร (3 modes)

### Mode A: Overpay Refund
**Trigger:** ปุ่ม "คืนเงิน" ใน OverpayBanner  
**URL ทดสอบ:** `/transactions/TXN-20260610-FOVPDEMO` → กดปุ่ม "คืนเงิน" ใน banner สีส้ม

```
┌────────────────────────────────────────────────────┐
│  คืนเงินให้ลูกค้า                            [✕]  │
│  ยอดคงเหลือที่ต้องคืน  ฿350.00                     │
├────────────────────────────────────────────────────┤
│                  [ไม่มี reason selector]            │
│                                                    │
│  เลือกช่องทางที่จะโอนคืน *                         │
│  ┌──────────────────────────────────────────┐     │
│  │ ● รายการที่ 1 — โอนผ่านธนาคาร           │     │
│  │   ฿3,200.00 · ธ.กสิกรไทย · xxxx5678     │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ยอดที่จะคืน *    [฿ 350.00          ]            │
│  ชื่อบัญชีปลายทาง *  [________________]           │
│  ธนาคาร *           [เลือกธนาคาร ▼  ]            │
│  เลขบัญชีธนาคาร *  [________________]            │
│  หมายเหตุ (ไม่บังคับ) [______________]            │
│                                                    │
│  ℹ️  แนะนำ: แนบสลิปหลักฐานการโอนคืน               │
│     [+ แนบสลิปคืนเงิน]                             │
│                                                    │
│  ┄┄┄┄ ไม่ต้องการคืน? ถือเป็น Tip แทน ┄┄┄┄       │
│                              [ถือเป็น Tip →]       │
├────────────────────────────────────────────────────┤
│    [ยกเลิก]        [✓ ยืนยันคืนเงิน ฿350.00]     │
└────────────────────────────────────────────────────┘
```

**สิ่งที่เกิดขึ้นหลังยืนยัน:**  
เพิ่ม `RefundRecord` ใน payment → เพิ่ม audit trail `PAYMENT_REFUND_REQUESTED` + `PAYMENT_REFUNDED`

---

### Mode B: SukiPay-initiated Cancel (Manual Reason)
**Trigger:** ปุ่ม "ยกเลิกออเดอร์" (ไม่ใช่ all CASH) หรือ SETTLED + CASH  
**URL ทดสอบ (BANK_TRANSFER CLOSED):** `/transactions/TXN-20260609-CLSBT` → กดปุ่ม "ยกเลิกออเดอร์"  
**URL ทดสอบ (SETTLED CASH):** `/transactions/TXN-20260608-STLCASH` → กดปุ่ม "ยกเลิกออเดอร์"

```
┌────────────────────────────────────────────────────┐
│  ยกเลิกออเดอร์ / คืนเงิน                    [✕]  │
│  ℹ️ ยกเลิกออเดอร์ — คืนเงินผ่านโอนธนาคาร          │
│     กรุณาระบุเหตุผล                               │
├────────────────────────────────────────────────────┤
│  เหตุผลในการยกเลิก / คืนเงิน *                    │
│  ┌──────────────────────────────────────────┐     │
│  │ ○ คิดเงินผิด / แก้ไขยอดโดย Cashier      │     │
│  │ ○ สินค้ามีปัญหา / ลูกค้าขอเคลม          │     │
│  │   (ต้องระบุหมายเหตุ)                     │     │
│  │ ○ สินค้าหมดสต็อก (พบทีหลัง)             │     │
│  │ ○ ยกเลิก Order หลังชำระ                  │     │
│  │ ○ อื่นๆ (ต้องระบุหมายเหตุ)              │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  เลือกช่องทางที่จะโอนคืน *                         │
│  [payment selector ...]                            │
│                                                    │
│  ยอดที่จะคืน / บัญชีปลายทาง / ธนาคาร / เลขบัญชี  │
│  [fields ...]                                      │
│                                                    │
│  หมายเหตุ (* บังคับสำหรับบาง reason)              │
├────────────────────────────────────────────────────┤
│    [ยกเลิก]        [✓ ยืนยันคืนเงิน ฿X.XX]       │
└────────────────────────────────────────────────────┘
```

---

### Mode C: OMS-cancelled (Pre-filled Reason)
**Trigger:** Banner "ถูกยกเลิกโดย OMS" → ปุ่ม "ดำเนินการคืนเงิน" (BANK_TRANSFER หรือ SETTLED)  
**URL ทดสอบ (CLOSED + BT):** `/transactions/TXN-20260522-CXLDEMO` → กดปุ่ม "ดำเนินการคืนเงิน"  
**URL ทดสอบ (SETTLED):** `/transactions/TXN-20260607-OMSSTLD` → กดปุ่ม "ดำเนินการคืนเงิน"

```
┌────────────────────────────────────────────────────┐
│  ยกเลิกออเดอร์ / คืนเงิน                    [✕]  │
│  ℹ️ ยกเลิกโดย OMS — เหตุผลถูกระบุมาจากระบบ        │
│     ระบุข้อมูลบัญชีเพื่อโอนเงินคืน               │
├────────────────────────────────────────────────────┤
│  เหตุผลในการยกเลิก                                 │
│  ┌──────────────────────────────────────────┐     │
│  │ ✅ ลูกค้าขอยกเลิก  (สีเขียว, read-only) │     │  ← pre-filled จาก OMS
│  └──────────────────────────────────────────┘     │
│                                                    │
│  เลือกช่องทางที่จะโอนคืน *                         │
│  [payment selector ...]                            │
│                                                    │
│  ยอดที่จะคืน / บัญชีปลายทาง / ธนาคาร / เลขบัญชี  │
│  [fields ... เหมือน Mode B ทุกอย่าง]              │
│                                                    │
│  หมายเหตุ (ไม่บังคับ)                             │
├────────────────────────────────────────────────────┤
│    [ยกเลิก]        [✓ ยืนยันคืนเงิน ฿X.XX]       │
└────────────────────────────────────────────────────┘
```

**ความแตกต่างจาก Mode B:**
- Reason selector ถูกซ่อน → แสดง label สีเขียวแทน
- Subtitle เปลี่ยน → "เหตุผลถูกระบุมาจากระบบ"
- ไม่ต้อง validate reason (pre-filled อยู่แล้ว)
- ส่วนอื่นทั้งหมด (payment, amount, bank, note) เหมือนกันทุกอย่าง

---

## Modal 3 — TipConfirmDialog
**ไฟล์:** `src/components/transactions/TipConfirmDialog.tsx`  
**ใช้เมื่อ:** Overpay และ Finance Manager เลือกไม่คืนเงิน (ถือเป็น Tip แทน)

**Trigger 2 จุด:**
1. ปุ่ม "ถือเป็น Tip" ใน OverpayBanner (โดยตรง)
2. ปุ่ม "ถือเป็น Tip →" ภายใน RefundDialog Mode A (เปลี่ยนใจไม่คืน)

**URL ทดสอบ:** `/transactions/TXN-20260610-FOVPDEMO` → กดปุ่ม "ถือเป็น Tip"

```
┌────────────────────────────────────────────────┐
│                                                │
│              ℹ️  (info icon)                   │
│                                                │
│           ยืนยันว่าเป็น Tip                   │
│                                                │
│   ยืนยันว่าไม่ต้องคืนเงิน ยอดเกิน             │
│           ฿350.00  ถือเป็น Tip?               │
│                                                │
│   ⚠️ การดำเนินการนี้ไม่สามารถเลิกทำได้        │
│                                                │
├────────────────────────────────────────────────┤
│        [ยกเลิก]       [ยืนยัน]               │
└────────────────────────────────────────────────┘
```

**สิ่งที่เกิดขึ้นหลังยืนยัน:**  
`overpay_acknowledged = true` → OverpayBanner หายไป  
Toast: "บันทึก Tip เรียบร้อย"

---

## ตาราง Case ↔ Modal สรุป

| Transaction | Scenario | Payment | Pre-cancel status | Modal ที่เปิด |
|---|---|---|---|---|
| `TXN-20260611-OMSNOPAY` | OMS cancel, ก่อนชำระ | — | PENDING | ❌ ไม่มี modal (view only) |
| `TXN-20260609-CVDEMO` | SukiPay cancel | CASH | CLOSED | **1A** VoidDialog (เลือกเหตุผลเอง) |
| `TXN-20260610-OMSCASH` | OMS cancel | CASH | CLOSED | **1B** VoidDialog (เหตุผล pre-filled) |
| `TXN-20260608-STLCASH` | SukiPay cancel | CASH | SETTLED | **2B** RefundDialog (เลือกเหตุผลเอง) |
| `TXN-20260609-CLSBT` | SukiPay cancel | BANK_TRANSFER | CLOSED | **2B** RefundDialog (เลือกเหตุผลเอง) |
| `TXN-20260401-STLDEMO` | SukiPay cancel | BANK_TRANSFER | SETTLED | **2B** RefundDialog (เลือกเหตุผลเอง) |
| `TXN-20260522-CXLDEMO` | OMS cancel | BANK_TRANSFER | CLOSED | **2C** RefundDialog (เหตุผล pre-filled) |
| `TXN-20260607-OMSSTLD` | OMS cancel | BANK_TRANSFER | SETTLED | **2C** RefundDialog (เหตุผล pre-filled) |
| `TXN-20260610-FOVPDEMO` | Overpay refund | BANK_TRANSFER | CLOSED | **2A** RefundDialog (overpay, no reason) |
| `TXN-20260610-OVPDEMO` | Overpay partial refund | BANK_TRANSFER | CLOSED | **2A** RefundDialog (overpay, no reason) |
| `TXN-20260610-FOVPDEMO` | Overpay → Tip | BANK_TRANSFER | CLOSED | **3** TipConfirmDialog |

---

## Props Summary

### VoidDialog
```typescript
preFilledReason?: string   // label จาก OMS (ถ้าระบุ: ซ่อน reason list, needsCashConfirm = true เสมอ)
cashAmount: number         // ยอดเงินสดที่ต้องคืน
```

### RefundDialog
```typescript
cancelMode?: boolean       // true = order cancel flow (แสดง reason selector)
preFilledReason?: string   // reason code จาก OMS (ซ่อน reason selector แสดง label แทน)
overpayDelta: number       // ยอด overpay (0 = manual/cancel mode)
preSelectedPaymentId?: string
```

### TipConfirmDialog
```typescript
overpayDelta: number       // ยอดที่จะ acknowledge เป็น Tip
```

---

## วิธีถ่าย Screenshot (ต้อง manual)

เปิด dev server: `npm run dev`  
แล้วไปที่ URL ด้านบนตาม case ที่ต้องการ จากนั้นกดปุ่มตาม trigger ที่ระบุ

> **Note:** ไม่สามารถถ่าย screenshot โดยอัตโนมัติได้เพราะ toolset ไม่มี browser automation
