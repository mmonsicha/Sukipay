import type {
  Transaction, Payment, Slip, PaymentChannel, PaymentStatus, TransactionStatus,
  Store, Customer, StateHistoryEntry, AuditTrailEntry, RejectReason,
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
    return {
      slip_id: `slip-${seed}`,
      image_url: `https://picsum.photos/seed/${seed}/300/500`,
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

export const INITIAL_TRANSACTIONS: Transaction[] = generateMockTransactions(60);
