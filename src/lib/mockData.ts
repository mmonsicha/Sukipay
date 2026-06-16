import type {
  Transaction, Payment, Slip, PaymentChannel, PaymentStatus, TransactionStatus,
  Store, Customer, StateHistoryEntry, AuditTrailEntry, RejectReason, RefundRecord,
} from './types';

export const STORES_LIST: Store[] = [
  { id: 'store-001', name: 'สุขุมวิก 20' },
  { id: 'store-002', name: 'บิเกิ้ลชอป' },
  { id: 'store-003', name: 'รัชดาภิเษก' },
  { id: 'store-004', name: 'MRT ห้วยขวาง' },
  { id: 'store-005', name: 'สาขา ลาดพร้าว' },
  { id: 'store-006', name: 'สาขา บางนา' },
];

const BANKS = ['ธนาคารไทยพาณิชย์', 'ธนาคารกสิกรไทย', 'ธนาคารกรุงเทพ', 'ธนาคารกรุงไทย'];
const ACCOUNT_HOLDERS = ['บริษัท เซลสุกิ จำกัด', 'ห้างหุ้นส่วน สยามเทรด', 'ร้านค้า รุ่งเรือง', 'บริษัท เพตรา ค้าส่ง จำกัด'];
const ACCOUNT_NUMBERS = ['1234567890', '0987654321', '1122334455', '9988776655'];
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const CUSTOMERS: Customer[] = [
  { name: 'สมชาย ใจดี',    contact: '081-234-5678', company_name: 'ร้านสมชาย เทรดดิ้ง' },
  { name: 'วิไล จันทร์',   contact: '082-345-6789', company_name: 'บริษัท วิไล ค้าส่ง จำกัด' },
  { name: 'ปิยะ มงคล',    contact: '083-456-7890', company_name: 'ห้างสรรพสินค้า ปิยะ' },
  { name: 'สุดา รักดี',   contact: 'suda@example.com', company_name: 'ร้านสุดา นำเข้า-ส่งออก' },
  { name: 'นิรัน ศรีสุข', contact: '084-567-8901', company_name: 'บริษัท ศรีสุข กรุ๊ป จำกัด' },
  { name: 'ณัฐา พรหมมา',  contact: 'natha@corp.co.th', company_name: 'บริษัท พรหมมา อินเตอร์ จำกัด' },
];

const FINANCE_MANAGERS = ['วิไล จันทร์', 'สมบัติ แก้ว', 'ประยุทธ์ ใจดี', 'ศิริพร นาม'];
const SELLERS = ['สมชาย ขาย', 'ณัฐา ส่ง', 'ปิยะ โอน', 'นิดา ชำระ'];
const REJECT_REASONS: RejectReason[] = ['AMOUNT_MISMATCH', 'WRONG_ACCOUNT', 'BLURRY_SLIP', 'DUPLICATE_SLIP', 'WRONG_DATE', 'OTHER'];

let txCounter = 0;

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }
function suffix(n: number) {
  return Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}
function dateStr(d: Date) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
function uid() { return Math.random().toString(36).slice(2, 10); }

const SLIP_IMAGES = [
  'https://thunder.in.th/wp-content/uploads/2024/06/%E0%B8%AA%E0%B8%A5%E0%B8%B4%E0%B8%9B%E0%B9%82%E0%B8%AD%E0%B8%99%E0%B9%80%E0%B8%87%E0%B8%B4%E0%B8%99.webp',
  'https://thunder.in.th/wp-content/uploads/2024/04/Screenshot-2567-07-03-at-13.21.01.png',
  'https://thunder.in.th/wp-content/uploads/2023/12/r7cbhdacsLXQNLp49Qm-o-1-230x300.jpg',
];

let slipImgCursor = 0;

function generateSlips(
  count: number,
  amount: number,
  transferTime: string | undefined,
  bankName: string | undefined,
  now: Date,
): Slip[] {
  if (count === 0) return [];
  const holder = pick(ACCOUNT_HOLDERS);
  const acctNo  = pick(ACCOUNT_NUMBERS);
  return Array.from({ length: count }, (_, i) => {
    const seed = Math.random().toString(36).slice(2, 9);
    const uploadedAt = new Date(now.getTime() + i * 120_000).toISOString();
    const imageUrl = SLIP_IMAGES[slipImgCursor % SLIP_IMAGES.length];
    slipImgCursor++;
    return {
      slip_id: `slip-${seed}`,
      image_url: imageUrl,
      uploaded_at: uploadedAt,
      amount: Math.round((amount / count) * 100) / 100,
      transfer_time: transferTime,
      bank_name: bankName,
      account_number: acctNo,
      account_holder: holder,
    };
  });
}

function splitAmount(total: number, parts: number): number[] {
  if (parts === 1) return [total];
  const splits: number[] = [];
  let remaining = total;
  for (let i = 0; i < parts - 1; i++) {
    const portion = Math.round(rnd(0.2, 0.6) * remaining * 100) / 100;
    splits.push(portion);
    remaining = Math.round((remaining - portion) * 100) / 100;
  }
  splits.push(remaining);
  return splits;
}

function generatePayments(
  now: Date,
  totalAmount: number,
  finalPayStatus: PaymentStatus,
): Payment[] {
  const count = Math.random() < 0.7 ? 2 : 3;
  const amounts = splitAmount(totalAmount, count);
  const channels: PaymentChannel[] = ['BANK_TRANSFER', 'BANK_TRANSFER', 'CASH', 'CASH', 'CREDIT'];

  return amounts.map((amt, i) => {
    const isLast = i === count - 1;
    const ch: PaymentChannel = pick(channels);
    const pStatus: PaymentStatus = isLast ? finalPayStatus : 'COMPLETED';
    const hasSlip = pStatus === 'UNDER_REVIEW' || pStatus === 'COMPLETED' || pStatus === 'REJECTED' || pStatus === 'FAILED';
    const hasTransfer = hasSlip && (ch === 'BANK_TRANSFER' || ch === 'CREDIT');
    const transferDate = hasTransfer
      ? new Date(now.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const slipCount = hasSlip ? 1 : 0;
    const bankName = (ch === 'BANK_TRANSFER' || ch === 'CREDIT') ? pick(BANKS) : undefined;
    const hasImgSlip = hasSlip && (ch === 'BANK_TRANSFER' || ch === 'CREDIT');
    const slips = hasImgSlip ? generateSlips(slipCount, amt, transferDate, bankName, now) : undefined;
    return {
      payment_id: `pay-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      seq: i + 1,
      payment_channel: ch,
      bank_name: bankName,
      transfer_time: transferDate,
      amount: amt,
      payment_status: pStatus,
      slip_count: slipCount,
      slips,
      slip_id: slips?.[0]?.slip_id,
      account_holder: slips?.[0]?.account_holder,
    };
  });
}

// ── State history & audit trail generators ──────────────────────────────────

function generateStateHistory(
  txStatus: TransactionStatus,
  createdAt: Date,
): StateHistoryEntry[] {
  const history: StateHistoryEntry[] = [
    { from_state: null, to_state: 'PENDING', at: createdAt.toISOString() },
  ];
  if (txStatus === 'CLOSED' || txStatus === 'SETTLED') {
    history.push({
      from_state: 'PENDING',
      to_state: 'CLOSED',
      at: new Date(createdAt.getTime() + rnd(60, 180) * 60_000).toISOString(),
    });
    if (txStatus === 'SETTLED') {
      history.push({
        from_state: 'CLOSED',
        to_state: 'SETTLED',
        at: new Date(createdAt.getTime() + (26 + rnd(0, 12)) * 3_600_000).toISOString(),
      });
    }
  } else if (txStatus === 'CANCELLED') {
    history.push({
      from_state: 'PENDING',
      to_state: 'CANCELLED',
      at: new Date(createdAt.getTime() + rnd(5, 30) * 60_000).toISOString(),
    });
  } else if (txStatus === 'EXPIRED') {
    history.push({
      from_state: 'PENDING',
      to_state: 'EXPIRED',
      at: new Date(createdAt.getTime() + 7 * 24 * 3_600_000).toISOString(),
    });
  }
  return history;
}

function generateAuditTrail(
  txId: string,
  txStatus: TransactionStatus,
  createdAt: Date,
  payments: Payment[],
): AuditTrailEntry[] {
  const entries: AuditTrailEntry[] = [];

  entries.push({
    id: `audit-${uid()}`,
    transaction_id: txId,
    event_type: 'TRANSACTION_CREATED',
    operator_type: 'system',
    created_at: createdAt.toISOString(),
  });

  payments.forEach((payment, idx) => {
    const addedAt = new Date(createdAt.getTime() + (idx + 1) * rnd(20, 60) * 60_000);

    entries.push({
      id: `audit-${uid()}`,
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED',
      operator_type: 'user',
      operator_name: pick(SELLERS),
      operator_role: 'Seller',
      created_at: addedAt.toISOString(),
    });

    const reviewAt = new Date(addedAt.getTime() + rnd(15, 60) * 60_000);

    if (payment.payment_status === 'COMPLETED') {
      entries.push({
        id: `audit-${uid()}`,
        transaction_id: txId,
        payment_id: payment.payment_id,
        event_type: 'PAYMENT_COMPLETED',
        operator_type: 'user',
        operator_name: pick(FINANCE_MANAGERS),
        operator_role: 'Finance Manager',
        created_at: reviewAt.toISOString(),
      });
    } else if (payment.payment_status === 'REJECTED') {
      // Optionally add a detail-edit before rejection
      if (Math.random() < 0.35) {
        entries.push({
          id: `audit-${uid()}`,
          transaction_id: txId,
          payment_id: payment.payment_id,
          event_type: 'PAYMENT_DETAIL_EDITED',
          operator_type: 'user',
          operator_name: pick(FINANCE_MANAGERS),
          operator_role: 'Finance Manager',
          created_at: new Date(addedAt.getTime() + rnd(5, 15) * 60_000).toISOString(),
        });
      }
      entries.push({
        id: `audit-${uid()}`,
        transaction_id: txId,
        payment_id: payment.payment_id,
        event_type: 'PAYMENT_REJECTED',
        operator_type: 'user',
        operator_name: pick(FINANCE_MANAGERS),
        operator_role: 'Finance Manager',
        metadata: { reject_reason: pick(REJECT_REASONS) },
        created_at: reviewAt.toISOString(),
      });
    }
  });

  // Transaction-level closing events
  if (txStatus === 'CLOSED' || txStatus === 'SETTLED') {
    const closeAt = new Date(createdAt.getTime() + rnd(90, 200) * 60_000);
    entries.push({
      id: `audit-${uid()}`,
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED',
      operator_type: 'system',
      created_at: closeAt.toISOString(),
    });
    if (txStatus === 'SETTLED') {
      entries.push({
        id: `audit-${uid()}`,
        transaction_id: txId,
        event_type: 'TRANSACTION_SETTLED',
        operator_type: 'system',
        created_at: new Date(closeAt.getTime() + (24 + rnd(0, 12)) * 3_600_000).toISOString(),
      });
    }
  } else if (txStatus === 'CANCELLED') {
    entries.push({
      id: `audit-${uid()}`,
      transaction_id: txId,
      event_type: 'TRANSACTION_CANCELLED',
      operator_type: 'system',
      created_at: new Date(createdAt.getTime() + rnd(5, 20) * 60_000).toISOString(),
    });
  } else if (txStatus === 'EXPIRED') {
    entries.push({
      id: `audit-${uid()}`,
      transaction_id: txId,
      event_type: 'TRANSACTION_EXPIRED',
      operator_type: 'system',
      created_at: new Date(createdAt.getTime() + 7 * 24 * 3_600_000).toISOString(),
    });
  }

  // Sort DESC (ใหม่สุดขึ้นก่อน) per PAT-2040 Section 7 spec
  return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── Main generator ──────────────────────────────────────────────────────────

export function generateTransaction(ageMs = 0): Transaction {
  txCounter++;
  const now = new Date(Date.now() - ageMs);

  const channel: PaymentChannel = pick([
    'BANK_TRANSFER', 'BANK_TRANSFER', 'BANK_TRANSFER',
    'CASH', 'CREDIT', 'COD',
  ]);

  const bucket = pick([
    'pending', 'pending', 'pending',
    'rejected',
    'review', 'review',
    'success', 'success', 'success',
    'cancelled',
    'other',
  ]);

  let txStatus: TransactionStatus;
  let payStatus: PaymentStatus;

  switch (bucket) {
    case 'pending':
      txStatus = 'PENDING'; payStatus = 'PENDING'; break;
    case 'rejected':
      txStatus = 'PENDING'; payStatus = pick(['REJECTED', 'FAILED']); break;
    case 'review':
      txStatus = 'PENDING'; payStatus = 'UNDER_REVIEW'; break;
    case 'success':
      txStatus = pick(['CLOSED', 'SETTLED']); payStatus = 'COMPLETED'; break;
    case 'cancelled':
      txStatus = 'CANCELLED'; payStatus = pick(['PENDING', 'COMPLETED', 'REJECTED']); break;
    default:
      txStatus = pick(['FAILED', 'EXPIRED']); payStatus = 'PENDING';
  }

  const amount = Math.round(rnd(500, 50000) * 100) / 100;
  const hasDiscount = Math.random() < 0.12;
  const store = pick(STORES_LIST);
  const customer = pick(CUSTOMERS);

  const hasSlip = payStatus === 'UNDER_REVIEW' || payStatus === 'COMPLETED' || payStatus === 'REJECTED' || payStatus === 'FAILED';
  const hasTransferField = hasSlip && (channel === 'BANK_TRANSFER' || channel === 'CREDIT');
  const transferTime = hasTransferField
    ? new Date(now.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const slipCount = hasSlip ? 1 : 0;
  const isExpandable = Math.random() < 0.25;

  const txId = `tx-${Date.now()}-${txCounter}`;

  // Generate payments
  const payments = isExpandable ? generatePayments(now, amount, payStatus) : undefined;

  // For non-expandable, build a synthetic single-payment list for audit trail generation
  const bankName = channel === 'BANK_TRANSFER' || channel === 'CREDIT' ? pick(BANKS) : undefined;
  const slips = hasTransferField ? generateSlips(slipCount, amount, transferTime, pick(BANKS), now) : undefined;

  const syntheticPayments: Payment[] = payments ?? [{
    payment_id: `pay-${txId}-1`,
    seq: 1,
    payment_channel: channel,
    bank_name: bankName,
    transfer_time: transferTime,
    amount,
    payment_status: payStatus,
    slip_count: slipCount,
    slips,
    slip_id: slips?.[0]?.slip_id,
    account_holder: slips?.[0]?.account_holder,
  }];

  const stateHistory = generateStateHistory(txStatus, now);
  const auditTrail = generateAuditTrail(txId, txStatus, now, syntheticPayments);

  // Order serial — SC-YYYYMM-NNNNN format
  const orderSerial = `SC-${now.toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0')}`;

  return {
    transaction_id: txId,
    transaction_no: `TXN-${dateStr(now)}-${suffix(6)}`,
    order_no: `SO${Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000)}`,
    order_serial: orderSerial,
    order_total: Math.round((amount + rnd(-500, 500)) * 100) / 100,
    customer,
    store_name: store.name,
    store_id: store.id,
    payment_channel: channel,
    bank_name: bankName,
    transfer_time: transferTime,
    amount,
    discount_amount: hasDiscount ? Math.round(amount * rnd(0.05, 0.2) * 100) / 100 : undefined,
    currency: 'THB',
    slip_count: slipCount,
    slips,
    payment_status: payStatus,
    transaction_status: txStatus,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    is_expandable: isExpandable,
    payments,
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

export function generateMockTransactions(count: number, maxAgeMs = 30 * 24 * 60 * 60 * 1000): Transaction[] {
  return Array.from({ length: count }, () => generateTransaction(Math.random() * maxAgeMs))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── PAT-2036: Overpay showcase transaction ───────────────────────────────────
// Transaction ที่ถูก CLOSED แล้ว แต่ลูกค้าจ่ายเกิน ฿500
// มี 3 payments: CASH + BANK_TRANSFER × 2
// Payment 2 (BANK_TRANSFER) มีการคืนเงินไปแล้ว ฿300 (demo pre-loaded)
// คงเหลือคืน: ฿200

function createOverpayShowcaseTransaction(): Transaction {
  const now = new Date('2026-05-20T09:30:00.000Z');
  const orderTotal = 4_000.00;
  const paidAmount = 4_500.00;   // จ่ายเกิน ฿500
  const overpayDelta = paidAmount - orderTotal; // ฿500
  const txId = 'tx-overpay-demo-001';

  // ── Slips ─────────────────────────────────────────────────────────────────
  const slip2: Slip = {
    slip_id: 'slip-overpay-002',
    image_url: SLIP_IMAGES[1],
    uploaded_at: new Date(now.getTime() + 18 * 60_000).toISOString(),
    amount: 2_000.00,
    transfer_time: new Date(now.getTime() + 8 * 60_000).toISOString(),
    bank_name: 'ธนาคารไทยพาณิชย์',
    account_number: '1234567890',
    account_holder: 'บริษัท เซลสุกิ จำกัด',
  };

  const slip3: Slip = {
    slip_id: 'slip-overpay-003',
    image_url: SLIP_IMAGES[2],
    uploaded_at: new Date(now.getTime() + 25 * 60_000).toISOString(),
    amount: 1_500.00,
    transfer_time: new Date(now.getTime() + 12 * 60_000).toISOString(),
    bank_name: 'ธนาคารกสิกรไทย',
    account_number: '0987654321',
    account_holder: 'บริษัท เซลสุกิ จำกัด',
  };

  // ── Pre-loaded refund on payment 2 (฿300 already returned) ───────────────
  const preloadedRefund: RefundRecord = {
    refund_id: 'refund-demo-001',
    payment_id: 'pay-overpay-demo-002',
    amount: 300.00,
    bank_code: '004',
    bank_name: 'กสิกรไทย (KBANK)',
    account_number: '1122334455',
    account_name: 'สมชาย ใจดี',
    note: 'คืนเงินส่วนที่ชำระเกิน งวดที่ 1',
    requested_at: new Date(now.getTime() + 110 * 60_000).toISOString(),
    requested_by: 'วิไล จันทร์',
    completed_at: new Date(now.getTime() + 125 * 60_000).toISOString(),
    status: 'COMPLETED',
    finance_task_id: 'ft-demo-refund-001',
  };

  // ── Payments ──────────────────────────────────────────────────────────────
  const payment1: Payment = {
    payment_id: 'pay-overpay-demo-001',
    seq: 1,
    payment_channel: 'CASH',
    amount: 1_000.00,
    payment_status: 'COMPLETED',
    slip_count: 0,
  };

  const payment2: Payment = {
    payment_id: 'pay-overpay-demo-002',
    seq: 2,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารไทยพาณิชย์',
    transfer_time: slip2.transfer_time,
    amount: 2_000.00,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip2],
    slip_id: slip2.slip_id,
    account_holder: slip2.account_holder,
    refunds: [preloadedRefund],
  };

  const payment3: Payment = {
    payment_id: 'pay-overpay-demo-003',
    seq: 3,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกสิกรไทย',
    transfer_time: slip3.transfer_time,
    amount: 1_500.00,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip3],
    slip_id: slip3.slip_id,
    account_holder: slip3.account_holder,
  };

  const payments = [payment1, payment2, payment3];

  // ── State history ─────────────────────────────────────────────────────────
  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING', at: now.toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',  at: new Date(now.getTime() + 90 * 60_000).toISOString() },
  ];

  // ── Audit trail ───────────────────────────────────────────────────────────
  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-ovp-001',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: now.toISOString(),
    },
    {
      id: 'audit-ovp-002',
      transaction_id: txId,
      payment_id: payment1.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'สมชาย ขาย',
      operator_role: 'Seller',
      created_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-003',
      transaction_id: txId,
      payment_id: payment1.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() + 35 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-004',
      transaction_id: txId,
      payment_id: payment2.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'สมชาย ขาย',
      operator_role: 'Seller',
      created_at: new Date(now.getTime() + 20 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-005',
      transaction_id: txId,
      payment_id: payment2.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() + 50 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-006',
      transaction_id: txId,
      payment_id: payment3.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'สมชาย ขาย',
      operator_role: 'Seller',
      created_at: new Date(now.getTime() + 28 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-007',
      transaction_id: txId,
      payment_id: payment3.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() + 60 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-008',
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() + 90 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-009',
      transaction_id: txId,
      event_type: 'TRANSACTION_AMOUNT_UPDATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() + 95 * 60_000).toISOString(),
    },
    // Pre-loaded refund audit entries for payment 2
    {
      id: 'audit-ovp-010',
      transaction_id: txId,
      payment_id: payment2.payment_id,
      event_type: 'PAYMENT_REFUND_REQUESTED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      metadata: {
        refund_amount: 300,
        refund_bank_name: 'กสิกรไทย (KBANK)',
        refund_account_number: '1122334455',
        refund_account_name: 'สมชาย ใจดี',
        refund_note: 'คืนเงินส่วนที่ชำระเกิน งวดที่ 1',
      },
      created_at: new Date(now.getTime() + 110 * 60_000).toISOString(),
    },
    {
      id: 'audit-ovp-011',
      transaction_id: txId,
      payment_id: payment2.payment_id,
      event_type: 'PAYMENT_REFUNDED' as const,
      operator_type: 'system' as const,
      metadata: {
        refund_amount: 300,
        refund_bank_name: 'กสิกรไทย (KBANK)',
        refund_account_number: '1122334455',
        refund_account_name: 'สมชาย ใจดี',
      },
      created_at: new Date(now.getTime() + 125 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260520-OVPDEMO',
    order_no: 'SO1234567890',
    order_serial: 'SC-202605-00042',
    order_total: orderTotal,
    customer: { name: 'สมชาย ใจดี', contact: '081-234-5678', company_name: 'ร้านสมชาย เทรดดิ้ง' },
    store_name: 'สุขุมวิก 20',
    store_id: 'store-001',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารไทยพาณิชย์',
    transfer_time: slip2.transfer_time,
    amount: paidAmount,
    currency: 'THB',
    slip_count: 2,
    payment_status: 'COMPLETED',
    transaction_status: 'CLOSED',
    created_at: now.toISOString(),
    updated_at: new Date(now.getTime() + 125 * 60_000).toISOString(),
    is_expandable: true,
    payments,
    state_history: stateHistory,
    audit_trail: auditTrail,
    // PAT-2036: ยอดชำระเกิน ฿500 — คืนแล้ว ฿300, คงเหลือ ฿200
    overpay_delta: overpayDelta,
    overpay_acknowledged: false,
  };
}

// ── PAT-2036: Cancelled + REFUND_PENDING showcase ────────────────────────────
// Scenario: OMS ยกเลิก order หลังลูกค้าโอนเงินผ่านธนาคารแล้ว
// System auto-สร้าง refund request → payment = REFUND_PENDING
// Finance Manager ต้องดำเนินการโอนเงินคืนผ่าน finance task
function createCancelledRefundPendingTransaction(): Transaction {
  const now = new Date('2026-05-22T11:15:00+07:00');
  const txId = 'tx-cancelled-refund-demo';
  const amount = 12800;

  const slip: Slip = {
    slip_id: 'slip-cxl-demo-1',
    image_url: SLIP_IMAGES[2],
    uploaded_at: new Date(now.getTime() - 90 * 60_000).toISOString(),
    amount,
    transfer_time: new Date(now.getTime() - 95 * 60_000).toISOString(),
    bank_name: 'ธนาคารกรุงเทพ',
    account_number: '1234567890',
    account_holder: 'บริษัท ศรีสุข กรุ๊ป จำกัด',
  };

  const payment: Payment = {
    payment_id: 'pay-cxl-demo-1',
    seq: 1,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกรุงเทพ',
    transfer_time: slip.transfer_time,
    amount,
    payment_status: 'REFUND_PENDING',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-cxl-1',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'สมชาย ขาย',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 95 * 60_000).toISOString(),
    },
    {
      id: 'audit-cxl-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
    {
      id: 'audit-cxl-3',
      transaction_id: txId,
      event_type: 'TRANSACTION_CANCELLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 20 * 60_000).toISOString(),
    },
    {
      id: 'audit-cxl-4',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_REFUND_REQUESTED' as const,
      operator_type: 'system' as const,
      metadata: { refund_amount: amount },
      created_at: new Date(now.getTime() - 19 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,       to_state: 'PENDING',    at: new Date(now.getTime() - 100 * 60_000).toISOString() },
    { from_state: 'PENDING',  to_state: 'CLOSED',     at: new Date(now.getTime() -  60 * 60_000).toISOString() },
    { from_state: 'CLOSED',   to_state: 'CANCELLED',  at: new Date(now.getTime() -  20 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260522-CXLDEMO',
    order_no: 'SO1234567891',
    order_serial: 'SC-202605-00055',
    order_total: amount,
    customer: { name: 'นิรัน ศรีสุข', contact: '084-567-8901', company_name: 'บริษัท ศรีสุข กรุ๊ป จำกัด' },
    store_name: 'รัชดาภิเษก',
    store_id: 'store-003',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกรุงเทพ',
    transfer_time: slip.transfer_time,
    amount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'REFUND_PENDING',
    transaction_status: 'CANCELLED',
    cancellation_reason: 'order_cancelled_by_customer',
    cancellation_note: 'ลูกค้าแจ้งผ่านระบบ OMS ว่าต้องการยกเลิก order',
    created_at: new Date(now.getTime() - 100 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() -  19 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── OMS-cancelled: CASH payment ──────────────────────────────────────────────
// Scenario: OMS ยกเลิก order เพราะสินค้าหมด ลูกค้าชำระเงินสดไปแล้ว
// System ต้องคืนเงินผ่านโอนธนาคาร (Finance ระบุบัญชีปลายทาง)
function createOmsCancelledCashTransaction(): Transaction {
  const now = new Date('2026-06-10T09:30:00+07:00');
  const txId = 'tx-oms-cancelled-cash-demo';
  const amount = 3200;

  const payment: Payment = {
    payment_id: 'pay-omscash-1',
    seq: 1,
    payment_channel: 'CASH',
    amount,
    payment_status: 'REFUND_PENDING',
    slip_count: 0,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-omscash-1',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'สมชาย ขาย',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 80 * 60_000).toISOString(),
    },
    {
      id: 'audit-omscash-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() - 70 * 60_000).toISOString(),
    },
    {
      id: 'audit-omscash-3',
      transaction_id: txId,
      event_type: 'TRANSACTION_CANCELLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: 'audit-omscash-4',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_REFUND_REQUESTED' as const,
      operator_type: 'system' as const,
      metadata: { refund_amount: amount },
      created_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING',   at: new Date(now.getTime() - 90 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',    at: new Date(now.getTime() - 70 * 60_000).toISOString() },
    { from_state: 'CLOSED',  to_state: 'CANCELLED', at: new Date(now.getTime() - 30 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260610-OMSCASH',
    order_no: 'SO9876543210',
    order_serial: 'SC-202606-00088',
    order_total: amount,
    customer: { name: 'ธนกร วงษ์สุวรรณ', contact: '091-234-5678', company_name: '' },
    store_name: 'สุขุมวิก 20',
    store_id: 'store-001',
    payment_channel: 'CASH',
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'REFUND_PENDING',
    transaction_status: 'CANCELLED',
    cancellation_reason: 'out_of_stock',
    cancellation_note: 'Warehouse ยืนยันว่าสินค้าหมด ไม่สามารถจัดส่งได้',
    created_at: new Date(now.getTime() - 90 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── PAT-2036 Option C: SETTLED transaction — manual refund trigger ────────────
// Scenario: ลูกค้าสั่งสินค้า 2 รายการ ชำระผ่านโอนธนาคาร 2,800 บาท
// ปิดยอดแล้ว แต่ warehouse พบทีหลังว่าสินค้า 1 รายการหมดสต็อก
// Finance Manager ต้องกด "คืนเงิน" ด้วยตัวเองและระบุเหตุผล
function createSettledManualRefundDemoTransaction(): Transaction {
  const now = new Date('2026-04-01T14:30:00+07:00');
  const txId = 'tx-settled-refund-demo';
  const amount = 2800;

  const slip: Slip = {
    slip_id: 'slip-stl-demo-1',
    image_url: SLIP_IMAGES[1],
    uploaded_at: new Date(now.getTime() - 120 * 60_000).toISOString(),
    amount,
    transfer_time: new Date(now.getTime() - 125 * 60_000).toISOString(),
    bank_name: 'ธนาคารกสิกรไทย',
    account_number: '0987654321',
    account_holder: 'บริษัท พรหมมา อินเตอร์ จำกัด',
  };

  const payment: Payment = {
    payment_id: 'pay-stl-demo-1',
    seq: 1,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกสิกรไทย',
    transfer_time: slip.transfer_time,
    amount,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-stl-1',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 130 * 60_000).toISOString(),
    },
    {
      id: 'audit-stl-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'ณัฐา ส่ง',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 125 * 60_000).toISOString(),
    },
    {
      id: 'audit-stl-3',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() - 95 * 60_000).toISOString(),
    },
    {
      id: 'audit-stl-4',
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 95 * 60_000).toISOString(),
    },
    {
      id: 'audit-stl-5',
      transaction_id: txId,
      event_type: 'TRANSACTION_SETTLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING',  at: new Date(now.getTime() - 130 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',   at: new Date(now.getTime() -  95 * 60_000).toISOString() },
    { from_state: 'CLOSED',  to_state: 'SETTLED',  at: new Date(now.getTime() -  30 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260401-STLDEMO',
    order_no: 'SO7654321098',
    order_serial: 'SC-202604-00021',
    order_total: amount,
    customer: { name: 'ณัฐา พรหมมา', contact: 'natha@corp.co.th', company_name: 'บริษัท พรหมมา อินเตอร์ จำกัด' },
    store_name: 'สาขา ลาดพร้าว',
    store_id: 'store-005',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกสิกรไทย',
    transfer_time: slip.transfer_time,
    amount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'COMPLETED',
    transaction_status: 'SETTLED',
    created_at: new Date(now.getTime() - 130 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── Scenario 2 CASH: SETTLED + CASH — ปิดยอดแล้ว (เงินสด) ───────────────────
// ทดสอบ: ปุ่ม "ยกเลิกออเดอร์ / คืนเงิน" ที่ต้องโอนคืนผ่านธนาคาร
function createSettledCashDemoTransaction(): Transaction {
  const now = new Date('2026-06-08T14:00:00+07:00');
  const txId = 'tx-settled-cash-demo';
  const amount = 2_800;

  const payment: Payment = {
    payment_id: 'pay-stlcash-1',
    seq: 1,
    payment_channel: 'CASH',
    amount,
    payment_status: 'COMPLETED',
    slip_count: 0,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-stlc-1',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 120 * 60_000).toISOString(),
    },
    {
      id: 'audit-stlc-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'ณัฐา ส่ง',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 115 * 60_000).toISOString(),
    },
    {
      id: 'audit-stlc-3',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 115 * 60_000).toISOString(),
    },
    {
      id: 'audit-stlc-4',
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 115 * 60_000).toISOString(),
    },
    {
      id: 'audit-stlc-5',
      transaction_id: txId,
      event_type: 'TRANSACTION_SETTLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING',  at: new Date(now.getTime() - 120 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',   at: new Date(now.getTime() - 115 * 60_000).toISOString() },
    { from_state: 'CLOSED',  to_state: 'SETTLED',  at: new Date(now.getTime() -  60 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260608-STLCASH',
    order_no: 'SO1234509876',
    order_serial: 'SC-202606-00081',
    order_total: amount,
    customer: { name: 'กมลา สุขใจ', contact: '082-111-2233', company_name: 'ร้านกมลา เบเกอรี่' },
    store_name: 'สาขา รามคำแหง',
    store_id: 'store-003',
    payment_channel: 'CASH',
    transfer_time: undefined,
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'COMPLETED',
    transaction_status: 'SETTLED',
    created_at: new Date(now.getTime() - 120 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── PAT-2036: Fresh overpay — no prior refund (แสดงตัวเลือก "ถือเป็น Tip") ────
// ใช้สำหรับทดสอบ Tip flow เพราะ OVPDEMO มี pre-loaded refund ฿300 อยู่แล้ว
function createFreshOverpayDemoTransaction(): Transaction {
  const now = new Date('2026-06-10T08:15:00+07:00');
  const txId = 'tx-fresh-overpay-demo';
  const orderTotal = 3_200;
  const paidAmount = 3_550;    // เกิน ฿350
  const overpayDelta = paidAmount - orderTotal;

  const slip: Slip = {
    slip_id: 'slip-fovp-1',
    image_url: SLIP_IMAGES[0],
    uploaded_at: new Date(now.getTime() - 50 * 60_000).toISOString(),
    amount: paidAmount,
    transfer_time: new Date(now.getTime() - 55 * 60_000).toISOString(),
    bank_name: 'ธนาคารกรุงไทย',
    account_number: '1122334455',
    account_holder: 'ห้างหุ้นส่วน สยามเทรด',
  };

  const payment: Payment = {
    payment_id: 'pay-fovp-1',
    seq: 1,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกรุงไทย',
    transfer_time: slip.transfer_time,
    amount: paidAmount,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
    // ไม่มี refunds — ยังไม่เคยคืน
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-fovp-1',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
    {
      id: 'audit-fovp-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'นิดา ชำระ',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 55 * 60_000).toISOString(),
    },
    {
      id: 'audit-fovp-3',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: 'audit-fovp-4',
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: 'audit-fovp-5',
      transaction_id: txId,
      event_type: 'TRANSACTION_AMOUNT_UPDATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING', at: new Date(now.getTime() - 60 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',  at: new Date(now.getTime() - 30 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260610-FOVPDEMO',
    order_no: 'SO1122334455',
    order_serial: 'SC-202606-00097',
    order_total: orderTotal,
    customer: { name: 'สุดา รักดี', contact: 'suda@example.com', company_name: 'ร้านสุดา นำเข้า-ส่งออก' },
    store_name: 'สาขา บางนา',
    store_id: 'store-006',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกรุงไทย',
    transfer_time: slip.transfer_time,
    amount: paidAmount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'COMPLETED',
    transaction_status: 'CLOSED',
    created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
    overpay_delta: overpayDelta,
    overpay_acknowledged: false,
  };
}

// ── Case 3: CLOSED + BANK_TRANSFER — ยกเลิกออเดอร์ (ก่อนปิดยอด) ───────────────
// โอนผ่านธนาคาร อนุมัติแล้ว แต่ยังไม่ settle → คืนผ่านโอนธนาคาร
function createClosedBankTransferDemoTransaction(): Transaction {
  const now = new Date('2026-06-09T11:00:00+07:00');
  const txId = 'tx-closed-bt-demo';
  const amount = 4_200;

  const slip: Slip = {
    slip_id: 'slip-clsbt-1',
    image_url: SLIP_IMAGES[2 % SLIP_IMAGES.length],
    uploaded_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    amount,
    transfer_time: new Date(now.getTime() - 65 * 60_000).toISOString(),
    bank_name: 'ธนาคารไทยพาณิชย์',
    account_number: '4041234567',
    account_holder: 'ห้างสรรพสินค้า สุขสันต์',
  };

  const payment: Payment = {
    payment_id: 'pay-clsbt-1',
    seq: 1,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารไทยพาณิชย์',
    transfer_time: slip.transfer_time,
    amount,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-clsbt-1',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 90 * 60_000).toISOString(),
    },
    {
      id: 'audit-clsbt-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'นิดา ชำระ',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 65 * 60_000).toISOString(),
    },
    {
      id: 'audit-clsbt-3',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
    {
      id: 'audit-clsbt-4',
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING', at: new Date(now.getTime() - 90 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',  at: new Date(now.getTime() - 45 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260609-CLSBT',
    order_no: 'SO4201234567',
    order_serial: 'SC-202606-00089',
    order_total: amount,
    customer: { name: 'สมหมาย เจริญกิจ', contact: 'sommai@corp.th', company_name: 'ห้างสรรพสินค้า สุขสันต์' },
    store_name: 'สาขา อโศก',
    store_id: 'store-002',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารไทยพาณิชย์',
    transfer_time: slip.transfer_time,
    amount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'COMPLETED',
    transaction_status: 'CLOSED',
    created_at: new Date(now.getTime() - 90 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 45 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── PAT-2038: Cash VOID showcase transaction ─────────────────────────────────
// Transaction ที่รับเงินสดครบแล้ว (CLOSED + CASH COMPLETED)
// รอ Cashier กด VOID ก่อน settlement (แสดงปุ่ม "ยกเลิกการชำระ")
function createCashVoidShowcaseTransaction(): Transaction {
  const now = new Date('2026-06-09T09:45:00+07:00');
  const txId = 'tx-cash-void-demo';
  const amount = 1500;

  const payment: Payment = {
    payment_id: 'pay-cash-void-1',
    seq: 1,
    payment_channel: 'CASH',
    amount,
    payment_status: 'COMPLETED',
    slip_count: 0,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-cv-1',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'ณัฐา ส่ง',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: 'audit-cv-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    },
    {
      id: 'audit-cv-3',
      transaction_id: txId,
      event_type: 'TRANSACTION_CLOSED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING', at: new Date(now.getTime() - 35 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',  at: new Date(now.getTime() - 29 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260609-CVDEMO',
    order_no: 'SO9876543210',
    order_serial: 'SC-202606-00088',
    order_total: amount,
    customer: { name: 'ปิยะ มงคล', contact: '083-456-7890', company_name: 'ห้างสรรพสินค้า ปิยะ' },
    store_name: 'MRT ห้วยขวาง',
    store_id: 'store-004',
    payment_channel: 'CASH',
    transfer_time: undefined,
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'COMPLETED',
    transaction_status: 'CLOSED',
    created_at: new Date(now.getTime() - 35 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 29 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── OMS-cancelled: ยกเลิกก่อนมีการชำระ ─────────────────────────────────────
// Scenario: OMS ยกเลิก order ก่อนลูกค้าชำระเงิน ไม่ต้องคืนเงิน ดูรายละเอียดได้อย่างเดียว
function createOmsCancelledBeforePaymentTransaction(): Transaction {
  const now = new Date('2026-06-11T08:00:00+07:00');
  const txId = 'tx-oms-cancelled-nopay-demo';
  const amount = 5600;

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-omsnopay-1',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
    {
      id: 'audit-omsnopay-2',
      transaction_id: txId,
      event_type: 'TRANSACTION_CANCELLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 10 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,       to_state: 'PENDING',    at: new Date(now.getTime() - 45 * 60_000).toISOString() },
    { from_state: 'PENDING',  to_state: 'CANCELLED',  at: new Date(now.getTime() - 10 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260611-OMSNOPAY',
    order_no: 'SO1122334455',
    order_serial: 'SC-202606-00099',
    order_total: amount,
    customer: { name: 'สุรีย์ วงศ์สุข', contact: '098-765-4321', company_name: '' },
    store_name: 'บิเกิ้ลชอป',
    store_id: 'store-002',
    payment_channel: 'BANK_TRANSFER',
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'PENDING',
    transaction_status: 'CANCELLED',
    cancellation_reason: 'product_issue',
    cancellation_note: 'ลูกค้าเปลี่ยนใจ สินค้ามีตำหนิ',
    created_at: new Date(now.getTime() - 45 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 10 * 60_000).toISOString(),
    is_expandable: false,
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── OMS-cancelled: หลัง settled (SETTLED → CANCELLED) ──────────────────────
// Scenario: ลูกค้าโอนเงินผ่านธนาคาร บัญชีตัดแล้ว (SETTLED)
// OMS ยกเลิกภายหลัง → ต้องคืนเงินผ่านโอนธนาคาร (RefundDialog + preFilledReason)
function createOmsCancelledAfterSettledTransaction(): Transaction {
  const now = new Date('2026-06-07T15:00:00+07:00');
  const txId = 'tx-oms-cancelled-settled-demo';
  const amount = 7800;

  const slip: Slip = {
    slip_id: 'slip-omsstl-1',
    image_url: SLIP_IMAGES[0],
    uploaded_at: new Date(now.getTime() - 200 * 60_000).toISOString(),
    amount,
    transfer_time: new Date(now.getTime() - 210 * 60_000).toISOString(),
    bank_name: 'ธนาคารไทยพาณิชย์',
    account_number: '4001234567',
    account_holder: 'นายวีระ สมใจ',
  };

  const payment: Payment = {
    payment_id: 'pay-omsstl-1',
    seq: 1,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารไทยพาณิชย์',
    transfer_time: slip.transfer_time,
    amount,
    payment_status: 'REFUND_PENDING',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-omsstl-1',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'สมชาย ขาย',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 210 * 60_000).toISOString(),
    },
    {
      id: 'audit-omsstl-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'user' as const,
      operator_name: 'วิไล จันทร์',
      operator_role: 'Finance Manager',
      created_at: new Date(now.getTime() - 180 * 60_000).toISOString(),
    },
    {
      id: 'audit-omsstl-3',
      transaction_id: txId,
      event_type: 'TRANSACTION_SETTLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
    {
      id: 'audit-omsstl-4',
      transaction_id: txId,
      event_type: 'TRANSACTION_CANCELLED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 20 * 60_000).toISOString(),
    },
    {
      id: 'audit-omsstl-5',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_REFUND_REQUESTED' as const,
      operator_type: 'system' as const,
      metadata: { refund_amount: amount },
      created_at: new Date(now.getTime() - 19 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,        to_state: 'PENDING',    at: new Date(now.getTime() - 220 * 60_000).toISOString() },
    { from_state: 'PENDING',   to_state: 'CLOSED',     at: new Date(now.getTime() - 180 * 60_000).toISOString() },
    { from_state: 'CLOSED',    to_state: 'SETTLED',    at: new Date(now.getTime() -  60 * 60_000).toISOString() },
    { from_state: 'SETTLED',   to_state: 'CANCELLED',  at: new Date(now.getTime() -  20 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260607-OMSSTLD',
    order_no: 'SO5544332211',
    order_serial: 'SC-202606-00077',
    order_total: amount,
    customer: { name: 'วีระ สมใจ', contact: '092-111-2222', company_name: 'บริษัท วีระ เทรด จำกัด' },
    store_name: 'MRT ห้วยขวาง',
    store_id: 'store-004',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารไทยพาณิชย์',
    transfer_time: slip.transfer_time,
    amount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'REFUND_PENDING',
    transaction_status: 'CANCELLED',
    cancellation_reason: 'cashier_error',
    cancellation_note: 'Cashier บันทึกราคาสินค้าผิด OMS แก้ไขและยกเลิก order',
    created_at: new Date(now.getTime() - 220 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() -  19 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

// ── PAT-2426: PENDING + CASH COMPLETED — ยกเลิกการบันทึกชำระ (ไม่มีการรับเงินจริง) ──
// Scenario: แคชเชียร์บันทึกรับเงินสดผิดพลาด transaction ยัง PENDING (ยังไม่ CLOSE)
// ปุ่ม "ยกเลิกออเดอร์" ควรแสดง VoidDialog แบบ PAT-2426 + order warning
function createPendingCashVoidDemoTransaction(): Transaction {
  const now = new Date('2026-06-16T10:05:00+07:00');
  const txId = 'tx-pending-cash-void-demo';
  const amount = 3_200;

  const payment: Payment = {
    payment_id: 'pay-pendcash-1',
    seq: 1,
    payment_channel: 'CASH',
    amount,
    payment_status: 'COMPLETED',
    slip_count: 0,
  };

  const auditTrail: AuditTrailEntry[] = ([
    {
      id: 'audit-pc-1',
      transaction_id: txId,
      event_type: 'TRANSACTION_CREATED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 10 * 60_000).toISOString(),
    },
    {
      id: 'audit-pc-2',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_ADDED' as const,
      operator_type: 'user' as const,
      operator_name: 'ณัฐา ส่ง',
      operator_role: 'Cashier',
      created_at: new Date(now.getTime() - 8 * 60_000).toISOString(),
    },
    {
      id: 'audit-pc-3',
      transaction_id: txId,
      payment_id: payment.payment_id,
      event_type: 'PAYMENT_COMPLETED' as const,
      operator_type: 'system' as const,
      created_at: new Date(now.getTime() - 8 * 60_000).toISOString(),
    },
  ] satisfies AuditTrailEntry[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null, to_state: 'PENDING', at: new Date(now.getTime() - 10 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260616-PNDCASH',
    order_no: 'SO7788996655',
    order_serial: 'SC-202606-00116',
    order_total: amount,
    customer: { name: 'ชญาน์ ทองดี', contact: '095-678-9012', company_name: 'ร้านชญาน์ ของฝาก' },
    store_name: 'สาขา ลาดพร้าว',
    store_id: 'store-005',
    payment_channel: 'CASH',
    transfer_time: undefined,
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'COMPLETED',
    transaction_status: 'PENDING',
    created_at: new Date(now.getTime() - 10 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 8 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

function createOmsCancelledPendingCashTransaction(): Transaction {
  const now = new Date('2026-06-16T14:00:00+07:00');
  const txId = 'tx-oms-pend-cash-demo';
  const amount = 4_500;

  const payment: Payment = {
    payment_id: 'pay-omspndcsh-1',
    seq: 1,
    payment_channel: 'CASH',
    amount,
    payment_status: 'REFUND_PENDING',
    slip_count: 0,
  };

  const auditTrail: AuditTrailEntry[] = ([
    { id: 'audit-omspndcsh-1', transaction_id: txId, event_type: 'TRANSACTION_CREATED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 60 * 60_000).toISOString() },
    { id: 'audit-omspndcsh-2', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_ADDED' as const, operator_type: 'user' as const, operator_name: 'ณัฐา ส่ง', operator_role: 'Cashier', created_at: new Date(now.getTime() - 55 * 60_000).toISOString() },
    { id: 'audit-omspndcsh-3', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_COMPLETED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 55 * 60_000).toISOString() },
    { id: 'audit-omspndcsh-4', transaction_id: txId, event_type: 'TRANSACTION_CANCELLED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 15 * 60_000).toISOString() },
    { id: 'audit-omspndcsh-5', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_REFUND_REQUESTED' as const, operator_type: 'system' as const, metadata: { refund_amount: amount }, created_at: new Date(now.getTime() - 14 * 60_000).toISOString() },
  ] satisfies AuditTrailEntry[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING',    at: new Date(now.getTime() - 60 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CANCELLED',  at: new Date(now.getTime() - 15 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260616-OMS01',
    order_no: 'SO2233445566',
    order_serial: 'SC-202606-00111',
    order_total: amount,
    customer: { name: 'ศิริพร นาม', contact: '089-111-2233', company_name: 'ร้านศิริพร เบเกอรี่' },
    store_name: 'สาขา ลาดพร้าว',
    store_id: 'store-005',
    payment_channel: 'CASH',
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'REFUND_PENDING',
    transaction_status: 'CANCELLED',
    cancellation_reason: 'out_of_stock',
    cancellation_note: 'OMS ยืนยัน: สินค้าหมดสต็อก ไม่สามารถจัดส่งได้',
    created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 14 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

function createOmsCancelledSettledCashTransaction(): Transaction {
  const now = new Date('2026-06-14T16:00:00+07:00');
  const txId = 'tx-oms-stl-cash-demo';
  const amount = 6_800;

  const payment: Payment = {
    payment_id: 'pay-omsstlcsh-1',
    seq: 1,
    payment_channel: 'CASH',
    amount,
    payment_status: 'REFUND_PENDING',
    slip_count: 0,
  };

  const auditTrail: AuditTrailEntry[] = ([
    { id: 'audit-omsstlcsh-1', transaction_id: txId, event_type: 'TRANSACTION_CREATED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 240 * 60_000).toISOString() },
    { id: 'audit-omsstlcsh-2', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_ADDED' as const, operator_type: 'user' as const, operator_name: 'สมชาย ขาย', operator_role: 'Cashier', created_at: new Date(now.getTime() - 235 * 60_000).toISOString() },
    { id: 'audit-omsstlcsh-3', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_COMPLETED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 235 * 60_000).toISOString() },
    { id: 'audit-omsstlcsh-4', transaction_id: txId, event_type: 'TRANSACTION_CLOSED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 235 * 60_000).toISOString() },
    { id: 'audit-omsstlcsh-5', transaction_id: txId, event_type: 'TRANSACTION_SETTLED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 180 * 60_000).toISOString() },
    { id: 'audit-omsstlcsh-6', transaction_id: txId, event_type: 'TRANSACTION_CANCELLED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 30 * 60_000).toISOString() },
    { id: 'audit-omsstlcsh-7', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_REFUND_REQUESTED' as const, operator_type: 'system' as const, metadata: { refund_amount: amount }, created_at: new Date(now.getTime() - 29 * 60_000).toISOString() },
  ] satisfies AuditTrailEntry[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,       to_state: 'PENDING',    at: new Date(now.getTime() - 240 * 60_000).toISOString() },
    { from_state: 'PENDING',  to_state: 'CLOSED',     at: new Date(now.getTime() - 235 * 60_000).toISOString() },
    { from_state: 'CLOSED',   to_state: 'SETTLED',    at: new Date(now.getTime() - 180 * 60_000).toISOString() },
    { from_state: 'SETTLED',  to_state: 'CANCELLED',  at: new Date(now.getTime() -  30 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260614-OMS05',
    order_no: 'SO3344556677',
    order_serial: 'SC-202606-00112',
    order_total: amount,
    customer: { name: 'บุญมา แสงสว่าง', contact: '092-444-5566', company_name: 'บริษัท บุญมา ค้าส่ง จำกัด' },
    store_name: 'MRT ห้วยขวาง',
    store_id: 'store-004',
    payment_channel: 'CASH',
    amount,
    currency: 'THB',
    slip_count: 0,
    payment_status: 'REFUND_PENDING',
    transaction_status: 'CANCELLED',
    cancellation_reason: 'order_cancel',
    cancellation_note: 'ลูกค้าขอยกเลิก order หลังรับสินค้าไปแล้ว OMS อนุมัติการยกเลิก',
    created_at: new Date(now.getTime() - 240 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() -  29 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

function createPendingBTVoidDemoTransaction(): Transaction {
  const now = new Date('2026-06-15T10:30:00+07:00');
  const txId = 'tx-sp-pend-bt-demo';
  const amount = 5_500;

  const slip: Slip = {
    slip_id: 'slip-sppndbt-1',
    image_url: SLIP_IMAGES[0],
    uploaded_at: new Date(now.getTime() - 15 * 60_000).toISOString(),
    amount,
    transfer_time: new Date(now.getTime() - 20 * 60_000).toISOString(),
    bank_name: 'ธนาคารกสิกรไทย',
    account_number: '0987654321',
    account_holder: 'บริษัท วิไล ค้าส่ง จำกัด',
  };

  const payment: Payment = {
    payment_id: 'pay-sppndbt-1',
    seq: 1,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกสิกรไทย',
    transfer_time: slip.transfer_time,
    amount,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
  };

  const auditTrail: AuditTrailEntry[] = ([
    { id: 'audit-sppndbt-1', transaction_id: txId, event_type: 'TRANSACTION_CREATED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 25 * 60_000).toISOString() },
    { id: 'audit-sppndbt-2', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_ADDED' as const, operator_type: 'user' as const, operator_name: 'สมชาย ขาย', operator_role: 'Seller', created_at: new Date(now.getTime() - 20 * 60_000).toISOString() },
    { id: 'audit-sppndbt-3', transaction_id: txId, payment_id: payment.payment_id, event_type: 'PAYMENT_COMPLETED' as const, operator_type: 'user' as const, operator_name: 'วิไล จันทร์', operator_role: 'Finance Manager', created_at: new Date(now.getTime() - 10 * 60_000).toISOString() },
  ] satisfies AuditTrailEntry[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null, to_state: 'PENDING', at: new Date(now.getTime() - 25 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260615-SPTX03',
    order_no: 'SO4455667788',
    order_serial: 'SC-202606-00113',
    order_total: amount,
    customer: { name: 'วิไล จันทร์', contact: '082-345-6789', company_name: 'บริษัท วิไล ค้าส่ง จำกัด' },
    store_name: 'บิเกิ้ลชอป',
    store_id: 'store-002',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกสิกรไทย',
    transfer_time: slip.transfer_time,
    amount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'COMPLETED',
    transaction_status: 'PENDING',
    created_at: new Date(now.getTime() - 25 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 10 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

function createMultiPaymentDemoTransaction(): Transaction {
  const now = new Date('2026-06-17T09:00:00+07:00');
  const txId = 'tx-sp-pay-multi-demo';
  const cashAmount = 2_000;
  const btAmount = 4_500;
  const totalAmount = cashAmount + btAmount;

  const slip: Slip = {
    slip_id: 'slip-sppay-1',
    image_url: SLIP_IMAGES[1 % SLIP_IMAGES.length],
    uploaded_at: new Date(now.getTime() - 40 * 60_000).toISOString(),
    amount: btAmount,
    transfer_time: new Date(now.getTime() - 45 * 60_000).toISOString(),
    bank_name: 'ธนาคารกรุงเทพ',
    account_number: '1234567890',
    account_holder: 'บริษัท เซลสุกิ จำกัด',
  };

  const payment1: Payment = {
    payment_id: 'pay-sppay-cash-1',
    seq: 1,
    payment_channel: 'CASH',
    amount: cashAmount,
    payment_status: 'COMPLETED',
    slip_count: 0,
  };

  const payment2: Payment = {
    payment_id: 'pay-sppay-bt-1',
    seq: 2,
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกรุงเทพ',
    transfer_time: slip.transfer_time,
    amount: btAmount,
    payment_status: 'COMPLETED',
    slip_count: 1,
    slips: [slip],
    slip_id: slip.slip_id,
    account_holder: slip.account_holder,
  };

  const auditTrail: AuditTrailEntry[] = ([
    { id: 'audit-sppay-1', transaction_id: txId, event_type: 'TRANSACTION_CREATED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 90 * 60_000).toISOString() },
    { id: 'audit-sppay-2', transaction_id: txId, payment_id: payment1.payment_id, event_type: 'PAYMENT_ADDED' as const, operator_type: 'user' as const, operator_name: 'ณัฐา ส่ง', operator_role: 'Cashier', created_at: new Date(now.getTime() - 80 * 60_000).toISOString() },
    { id: 'audit-sppay-3', transaction_id: txId, payment_id: payment1.payment_id, event_type: 'PAYMENT_COMPLETED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 80 * 60_000).toISOString() },
    { id: 'audit-sppay-4', transaction_id: txId, payment_id: payment2.payment_id, event_type: 'PAYMENT_ADDED' as const, operator_type: 'user' as const, operator_name: 'สมชาย ขาย', operator_role: 'Seller', created_at: new Date(now.getTime() - 45 * 60_000).toISOString() },
    { id: 'audit-sppay-5', transaction_id: txId, payment_id: payment2.payment_id, event_type: 'PAYMENT_COMPLETED' as const, operator_type: 'user' as const, operator_name: 'วิไล จันทร์', operator_role: 'Finance Manager', created_at: new Date(now.getTime() - 40 * 60_000).toISOString() },
    { id: 'audit-sppay-6', transaction_id: txId, event_type: 'TRANSACTION_CLOSED' as const, operator_type: 'system' as const, created_at: new Date(now.getTime() - 40 * 60_000).toISOString() },
  ] satisfies AuditTrailEntry[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stateHistory: StateHistoryEntry[] = [
    { from_state: null,      to_state: 'PENDING', at: new Date(now.getTime() - 90 * 60_000).toISOString() },
    { from_state: 'PENDING', to_state: 'CLOSED',  at: new Date(now.getTime() - 40 * 60_000).toISOString() },
  ];

  return {
    transaction_id: txId,
    transaction_no: 'TXN-20260617-SPPAY01',
    order_no: 'SO5566778899',
    order_serial: 'SC-202606-00114',
    order_total: totalAmount,
    customer: { name: 'ปิยะ มงคล', contact: '083-456-7890', company_name: 'ห้างสรรพสินค้า ปิยะ' },
    store_name: 'สุขุมวิก 20',
    store_id: 'store-001',
    payment_channel: 'BANK_TRANSFER',
    bank_name: 'ธนาคารกรุงเทพ',
    transfer_time: slip.transfer_time,
    amount: totalAmount,
    currency: 'THB',
    slip_count: 1,
    slips: [slip],
    payment_status: 'COMPLETED',
    transaction_status: 'CLOSED',
    created_at: new Date(now.getTime() - 90 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 40 * 60_000).toISOString(),
    is_expandable: true,
    payments: [payment1, payment2],
    state_history: stateHistory,
    audit_trail: auditTrail,
  };
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // ── GROUP 1: OMS-initiated cancellation ──────────────────────────────────
  createOmsCancelledPendingCashTransaction(),   // OMS-1: PENDING+Cash
  createOmsCancelledSettledCashTransaction(),    // OMS-5: SETTLED+Cash
  // ── GROUP 2: SukiPay Transaction-level void ───────────────────────────────
  createPendingBTVoidDemoTransaction(),          // SP-TX-3: PENDING+BT
  // ── GROUP 3: SukiPay Payment-level void (UI TBD) ──────────────────────────
  createMultiPaymentDemoTransaction(),           // SP-PAY-1: CLOSED Mixed Cash+BT
  // ── existing demos ─────────────────────────────────────────────────────────
  createPendingCashVoidDemoTransaction(),
  createOverpayShowcaseTransaction(),
  createFreshOverpayDemoTransaction(),
  createCancelledRefundPendingTransaction(),
  createOmsCancelledCashTransaction(),
  createOmsCancelledAfterSettledTransaction(),
  createOmsCancelledBeforePaymentTransaction(),
  createCashVoidShowcaseTransaction(),
  createClosedBankTransferDemoTransaction(),
  createSettledManualRefundDemoTransaction(),
  createSettledCashDemoTransaction(),
  ...generateMockTransactions(60),
];
