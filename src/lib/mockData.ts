import type { Transaction, Payment, Slip, PaymentChannel, PaymentStatus, TransactionStatus, Store } from './types';

export const STORES_LIST: Store[] = [
  { id: 'store-001', name: 'สุขุมวิก 20' },
  { id: 'store-002', name: 'บิเกิ้ลชอป' },
  { id: 'store-003', name: 'รัชดาภิเษก' },
  { id: 'store-004', name: 'MRT ห้วยขวาง' },
  { id: 'store-005', name: 'สาขา ลาดพร้าว' },
  { id: 'store-006', name: 'สาขา บางนา' },
];

const BANKS = ['ธนาคารไทยพาณิชย์', 'ธนาคารกสิกรไทย', 'ธนาคารกรุงเทพ', 'ธนาคารกรุงไทย'];
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let txCounter = 0;

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }
function suffix(n: number) {
  return Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}
function dateStr(d: Date) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }

// MOCK_ACCOUNT_NUMBERS — simulate merchant receiving accounts
const ACCOUNT_NUMBERS = ['1234567890', '0987654321', '1122334455', '9988776655'];

function generateSlips(
  count: number,
  amount: number,
  transferTime: string | undefined,
  bankName: string | undefined,
  now: Date,
): Slip[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const seed = Math.random().toString(36).slice(2, 9);
    const uploadedAt = new Date(now.getTime() + i * 120_000).toISOString(); // 2-min apart
    return {
      slip_id: `slip-${seed}`,
      image_url: `https://picsum.photos/seed/${seed}/300/500`,
      uploaded_at: uploadedAt,
      amount: Math.round((amount / count) * 100) / 100,
      transfer_time: transferTime,
      bank_name: bankName,
      account_number: pick(ACCOUNT_NUMBERS),
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
    const slipCount = hasSlip ? Math.floor(rnd(1, 3)) : 0;
    const bankName = (ch === 'BANK_TRANSFER' || ch === 'CREDIT') ? pick(BANKS) : undefined;
    const hasImgSlip = hasSlip && (ch === 'BANK_TRANSFER' || ch === 'CREDIT');
    return {
      payment_id: `pay-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      seq: i + 1,
      payment_channel: ch,
      bank_name: bankName,
      transfer_time: transferDate,
      amount: amt,
      payment_status: pStatus,
      slip_count: slipCount,
      slips: hasImgSlip ? generateSlips(slipCount, amt, transferDate, bankName, now) : undefined,
    };
  });
}

export function generateTransaction(ageMs = 0): Transaction {
  txCounter++;
  const now = new Date(Date.now() - ageMs);

  // Weighted channels per PAT-2039: BANK_TRANSFER / CASH / CREDIT / COD
  const channel: PaymentChannel = pick([
    'BANK_TRANSFER', 'BANK_TRANSFER', 'BANK_TRANSFER',
    'CASH', 'CREDIT', 'COD',
  ]);

  // Tab distribution — PAT-2039 tab logic:
  // รอชำระ:      tx=PENDING  + pay=PENDING/REJECTED/FAILED
  // รอตรวจสอบ:  tx=PENDING  + pay=UNDER_REVIEW
  // สำเร็จ:      tx=CLOSED/SETTLED + pay=COMPLETED
  // ยกเลิก:      tx=CANCELLED
  const bucket = pick([
    'pending', 'pending', 'pending',       // รอชำระ (heaviest — most common state)
    'rejected',                             // รอชำระ (slip rejected, re-submit path)
    'review', 'review',                    // รอตรวจสอบ
    'success', 'success', 'success',       // สำเร็จ
    'cancelled',                            // ยกเลิก
    'other',                               // FAILED/EXPIRED tx
  ]);

  let txStatus: TransactionStatus;
  let payStatus: PaymentStatus;

  switch (bucket) {
    case 'pending':
      txStatus = 'PENDING';
      payStatus = 'PENDING';
      break;
    case 'rejected':
      txStatus = 'PENDING';
      payStatus = pick(['REJECTED', 'FAILED']);
      break;
    case 'review':
      txStatus = 'PENDING';
      payStatus = 'UNDER_REVIEW';
      break;
    case 'success':
      txStatus = pick(['CLOSED', 'SETTLED']);
      payStatus = 'COMPLETED';
      break;
    case 'cancelled':
      txStatus = 'CANCELLED';
      payStatus = pick(['PENDING', 'COMPLETED', 'REJECTED']);
      break;
    default: // other
      txStatus = pick(['FAILED', 'EXPIRED']);
      payStatus = 'PENDING';
  }

  const amount = Math.round(rnd(500, 50000) * 100) / 100;
  const hasDiscount = Math.random() < 0.12;
  const store = pick(STORES_LIST);

  // transfer_time = slip submission date proxy; only when payment was actually submitted
  const hasSlip = payStatus === 'UNDER_REVIEW' || payStatus === 'COMPLETED' || payStatus === 'REJECTED' || payStatus === 'FAILED';
  const hasTransferField = hasSlip && (channel === 'BANK_TRANSFER' || channel === 'CREDIT');
  const transferTime = hasTransferField
    ? new Date(now.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const slipCount = payStatus === 'UNDER_REVIEW' ? Math.floor(rnd(1, 4))
    : payStatus === 'COMPLETED' ? Math.floor(rnd(1, 3))
    : payStatus === 'REJECTED' || payStatus === 'FAILED' ? Math.floor(rnd(1, 2))
    : 0;

  const isExpandable = Math.random() < 0.25;
  const payments = isExpandable ? generatePayments(now, amount, payStatus) : undefined;

  return {
    transaction_id: `tx-${Date.now()}-${txCounter}`,
    transaction_no: `TXN-${dateStr(now)}-${suffix(6)}`,
    order_no: `SO${Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000)}`,
    store_name: store.name,
    store_id: store.id,
    payment_channel: channel,
    bank_name: channel === 'BANK_TRANSFER' || channel === 'CREDIT' ? pick(BANKS) : undefined,
    transfer_time: transferTime,
    amount,
    discount_amount: hasDiscount ? Math.round(amount * rnd(0.05, 0.2) * 100) / 100 : undefined,
    currency: 'THB',
    slip_count: slipCount,
    slips: hasTransferField ? generateSlips(slipCount, amount, transferTime, pick(BANKS), now) : undefined,
    payment_status: payStatus,
    transaction_status: txStatus,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    is_expandable: isExpandable,
    payments,
  };
}

export function generateMockTransactions(count: number, maxAgeMs = 30 * 24 * 60 * 60 * 1000): Transaction[] {
  return Array.from({ length: count }, () => generateTransaction(Math.random() * maxAgeMs))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export const INITIAL_TRANSACTIONS: Transaction[] = generateMockTransactions(60);
