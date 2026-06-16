'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopNavbar from '@/components/layout/TopNavbar';
import Sidebar from '@/components/layout/Sidebar';
import SlipPreviewModal from './SlipPreviewModal';
import OverpayBanner from './OverpayBanner';
import RefundDialog, { type EligiblePayment, type RefundSubmitResult } from './RefundDialog';
import TipConfirmDialog from './TipConfirmDialog';
import VoidDialog from './VoidDialog';
import VoidBTDialog from './VoidBTDialog';
import { INITIAL_TRANSACTIONS } from '@/lib/mockData';
import type {
  Transaction, Payment, Slip,
  PaymentStatus, TransactionStatus, PaymentChannel,
  EventType, RejectReason, AuditTrailEntry, StateHistoryEntry, RefundRecord,
} from '@/lib/types';

// ── Formatters ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(d).replace(',', '');
}

function formatCompact(iso: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(new Date(iso)).replace(',', '');
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function maskAccount(acct: string): string {
  if (acct.length <= 4) return acct;
  return 'x'.repeat(acct.length - 4) + acct.slice(-4);
}

// ── Cancellation reason labels (shared with RefundDialog reason codes) ───────

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  cashier_error:                 'คิดเงินผิด / แก้ไขยอดโดย Cashier',
  product_issue:                 'สินค้ามีปัญหา / ลูกค้าขอเคลม',
  out_of_stock:                  'สินค้าหมดสต็อก (พบทีหลัง)',
  order_cancel:                  'ยกเลิก Order หลังชำระ',
  order_cancelled_by_customer:   'ลูกค้าขอยกเลิก',
  other:                         'อื่นๆ',
};

// ── Enum labels ──────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  BANK_TRANSFER: 'โอนเงินผ่านธนาคาร',
  CASH: 'เงินสด',
  CREDIT: 'บัตรเครดิต',
  COD: 'เก็บเงินปลายทาง (COD)',
};

const EVENT_LABELS: Record<EventType, string> = {
  PAYMENT_ADDED:                      'อัปโหลดสลิป',
  PAYMENT_COMPLETED:                  'อนุมัติการชำระเงิน',
  PAYMENT_REJECTED:                   'ปฏิเสธการชำระเงิน',
  PAYMENT_DETAIL_EDITED:              'แก้ไขข้อมูลการชำระ',
  PAYMENT_REFUNDED:                   'โอนเงินคืนแล้ว',
  PAYMENT_REFUND_REQUESTED:           'ส่งคำขอคืนเงิน',
  TRANSACTION_CREATED:                'สร้าง Transaction',
  TRANSACTION_CLOSED:                 'ปิด Transaction (ชำระครบ)',
  TRANSACTION_SETTLED:                'ยืนยันการตัดบัญชี',
  TRANSACTION_AMOUNT_UPDATED:         'อัปเดตยอด Transaction',
  TRANSACTION_CANCELLED:              'ยกเลิก Transaction',
  TRANSACTION_EXPIRED:                'Transaction หมดอายุ',
  TRANSACTION_OVERPAY_ACKNOWLEDGED:   'บันทึกยอดเกินเป็น Tip',
  VOID_PREPARED:                      'เตรียม Void',
  TRANSACTION_VOIDED:                 'ยกเลิกการชำระ (Void)',
  OMS_NOTIFIED:                       'แจ้ง OMS: ปรับสถานะยอดค้างชำระ',
};

const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  AMOUNT_MISMATCH: 'ยอดเงินไม่ตรง',
  WRONG_ACCOUNT:   'บัญชีผิด',
  BLURRY_SLIP:     'สลิปไม่ชัด',
  DUPLICATE_SLIP:  'สลิปซ้ำ',
  WRONG_DATE:      'วันที่ผิด',
  OTHER:           'อื่นๆ',
};

const PAYMENT_LEVEL_EVENTS = new Set<EventType>([
  'PAYMENT_ADDED', 'PAYMENT_COMPLETED', 'PAYMENT_REJECTED',
  'PAYMENT_DETAIL_EDITED', 'PAYMENT_REFUNDED', 'PAYMENT_REFUND_REQUESTED',
]);

// ── Status badge configs ─────────────────────────────────────────────────────

const PS_CFG: Record<PaymentStatus, { cls: string; label: string }> = {
  PENDING:        { cls: 'badge-ps-pending',        label: 'รอชำระ' },
  UNDER_REVIEW:   { cls: 'badge-ps-review',         label: 'รอตรวจสอบ' },
  COMPLETED:      { cls: 'badge-ps-completed',      label: 'อนุมัติแล้ว' },
  REJECTED:       { cls: 'badge-ps-rejected',       label: 'ปฏิเสธ' },
  FAILED:         { cls: 'badge-ps-failed',         label: 'ล้มเหลว' },
  VOIDED:         { cls: 'badge-ps-failed',         label: 'ยกเลิก' },
  REFUNDED:       { cls: 'badge-ts-closed',         label: 'คืนเงิน' },
  REFUND_PENDING: { cls: 'badge-ps-refund-pending', label: 'รอคืนเงิน' },
};

const TS_CFG: Record<TransactionStatus, { cls: string; label: string }> = {
  PENDING:       { cls: 'badge-ts-pending',        label: 'รอดำเนินการ' },
  CLOSED:        { cls: 'badge-ts-closed',         label: 'ชำระเงินแล้ว' },
  SETTLED:       { cls: 'badge-ts-settled',        label: 'สำเร็จแล้ว' },
  COMPLETED:     { cls: 'badge-ts-completed',      label: 'สำเร็จแล้ว' },
  CANCELLED:     { cls: 'badge-ts-cancelled',      label: 'ยกเลิก' },
  FAILED:        { cls: 'badge-ts-failed',         label: 'ล้มเหลว' },
  EXPIRED:       { cls: 'badge-ts-expired',        label: 'หมดอายุ' },
  VOID_PREPARED: { cls: 'badge-ts-void-prepared',  label: 'กำลังยกเลิก…' },
  VOID:          { cls: 'badge-ts-void',           label: 'ยกเลิกแล้ว' },
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { cls, label } = PS_CFG[status] ?? { cls: 'badge-ps-pending', label: status };
  return <span className={`status-badge ${cls}`}><span className="status-dot" />{label}</span>;
}

function TxStatusBadge({ status }: { status: TransactionStatus }) {
  const { cls, label } = TS_CFG[status] ?? { cls: 'badge-ts-pending', label: status };
  return <span className={`status-badge ${cls}`}><span className="status-dot" />{label}</span>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Empty() {
  return <span className="detail-empty">—</span>;
}

function InfoRow({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  return (
    <div className="detail-info-row">
      <span className="detail-info-label">{label}</span>
      <span className="detail-info-value">
        {value
          ? link
            ? <a href={link} className="detail-link">{value}</a>
            : value
          : <Empty />}
      </span>
    </div>
  );
}

// ── Channel icons ─────────────────────────────────────────────────────────────

function ChannelIcon({ channel }: { channel: PaymentChannel }) {
  const cls = {
    BANK_TRANSFER: 'pc2-channel-icon--bank',
    CASH:          'pc2-channel-icon--cash',
    CREDIT:        'pc2-channel-icon--credit',
    COD:           'pc2-channel-icon--cod',
  }[channel] ?? 'pc2-channel-icon--bank';

  const icons: Record<PaymentChannel, React.ReactNode> = {
    BANK_TRANSFER: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="10" width="18" height="11" rx="1"/><path d="M3 10l9-7 9 7"/><line x1="12" y1="10" x2="12" y2="21"/>
        <line x1="7" y1="10" x2="7" y2="21"/><line x1="17" y1="10" x2="17" y2="21"/>
      </svg>
    ),
    CASH: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <circle cx="12" cy="12" r="3"/><line x1="6" y1="6" x2="6" y2="18"/><line x1="18" y1="6" x2="18" y2="18"/>
      </svg>
    ),
    CREDIT: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>
      </svg>
    ),
    COD: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  };

  return <div className={`pc2-channel-icon ${cls}`}>{icons[channel]}</div>;
}

// ── Compact slip strip ────────────────────────────────────────────────────────

function SlipStrip({ slip, onOpen }: { slip: Slip; onOpen: (s: Slip) => void }) {
  return (
    <div className="pc2-slip-strip">
      <img
        src={slip.image_url}
        alt="สลิป"
        className="pc2-slip-thumb"
        onClick={() => onOpen(slip)}
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.25'; }}
      />
      <div className="pc2-slip-meta">
        <div className="pc2-slip-label">หลักฐานการโอน</div>
        <div className="pc2-slip-bank">{slip.bank_name ?? '—'}</div>
        {slip.account_number && (
          <div className="pc2-slip-acct">{maskAccount(slip.account_number)}</div>
        )}
      </div>
      <button className="pc2-slip-view-btn" onClick={() => onOpen(slip)}>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
        ดูสลิป
      </button>
    </div>
  );
}

// ── Refund item (always expanded) ────────────────────────────────────────────

function RefundStrip({ refund }: { refund: RefundRecord }) {
  return (
    <div className="pc3-refund-item">
      {/* Summary row */}
      <div className="pc3-refund-summary">
        <span className="pc3-refund-icon">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
          </svg>
        </span>
        <span className="pc3-refund-label">คืนเงิน</span>
        <span className="pc3-refund-amount">฿{formatAmount(refund.amount)}</span>
        <span className={`pc3-refund-badge${refund.status === 'COMPLETED' ? ' pc3-refund-badge--done' : ' pc3-refund-badge--pending'}`}>
          {refund.status === 'COMPLETED' ? 'สำเร็จ' : 'รอดำเนินการ'}
        </span>
      </div>

      {/* Detail rows */}
      <div className="pc3-refund-details">
        <div className="pc3-refund-row">
          <span className="pc3-refund-detail-label">ธนาคาร</span>
          <span className="pc3-refund-detail-value">{refund.bank_name}</span>
        </div>
        <div className="pc3-refund-row">
          <span className="pc3-refund-detail-label">เลขบัญชี</span>
          <span className="pc3-refund-detail-value">{maskAccount(refund.account_number)}</span>
        </div>
        <div className="pc3-refund-row">
          <span className="pc3-refund-detail-label">ชื่อบัญชี</span>
          <span className="pc3-refund-detail-value">{refund.account_name}</span>
        </div>
        <div className="pc3-refund-row">
          <span className="pc3-refund-detail-label">วันที่ส่งคำขอ</span>
          <span className="pc3-refund-detail-value">{formatDateTime(refund.requested_at)}</span>
        </div>
        {refund.completed_at && (
          <div className="pc3-refund-row">
            <span className="pc3-refund-detail-label">โอนสำเร็จเมื่อ</span>
            <span className="pc3-refund-detail-value">{formatDateTime(refund.completed_at)}</span>
          </div>
        )}
        {refund.requested_by && (
          <div className="pc3-refund-row">
            <span className="pc3-refund-detail-label">ดำเนินการโดย</span>
            <span className="pc3-refund-detail-value">{refund.requested_by}</span>
          </div>
        )}
        {refund.note && (
          <div className="pc3-refund-row">
            <span className="pc3-refund-detail-label">หมายเหตุ</span>
            <span className="pc3-refund-detail-value">{refund.note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-payment audit trail (collapsible) ────────────────────────────────────

function PerPaymentTrail({
  paymentId,
  auditTrail,
}: {
  paymentId: string;
  auditTrail: AuditTrailEntry[];
}) {
  const [open, setOpen] = useState(false);

  const entries = auditTrail
    .filter(e => e.payment_id === paymentId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!entries.length) return null;

  return (
    <div className="per-payment-trail">
      <button className="per-payment-trail-toggle" onClick={() => setOpen(o => !o)}>
        <span className={`per-payment-trail-chevron ${open ? 'open' : ''}`}>▶</span>
        ประวัติรายการนี้
        <span className="per-payment-trail-count">({entries.length} รายการ)</span>
      </button>
      {open && (
        <div className="per-payment-trail-panel">
          <div className="trail-timeline">
            {entries.map((entry, idx) => {
              const isLast = idx === entries.length - 1;
              const actorDisplay = entry.operator_type === 'system'
                ? 'ระบบ'
                : entry.operator_name
                  ? `${entry.operator_name}${entry.operator_role ? ` (${entry.operator_role})` : ''}`
                  : '—';

              const isRefundEvent = entry.event_type === 'PAYMENT_REFUND_REQUESTED' || entry.event_type === 'PAYMENT_REFUNDED';

              return (
                <div key={entry.id} className={`trail-entry${isRefundEvent ? ' trail-entry--refund' : ''}`}>
                  <div className="trail-dot-col">
                    <div className={`trail-dot${isRefundEvent ? ' trail-dot--refund' : ''}`} />
                    {!isLast && <div className="trail-line" />}
                  </div>
                  <div className="trail-content">
                    <div className="trail-datetime">{formatDateTime(entry.created_at)}</div>
                    <div className="trail-event-label">{EVENT_LABELS[entry.event_type] ?? entry.event_type}</div>
                    {isRefundEvent && entry.metadata?.refund_amount && (
                      <div className="trail-refund-meta">
                        ฿{formatAmount(entry.metadata.refund_amount)}
                        {entry.metadata.refund_bank_name && ` → ${entry.metadata.refund_bank_name}`}
                        {entry.metadata.refund_account_name && ` · ${entry.metadata.refund_account_name}`}
                      </div>
                    )}
                    <div className="trail-actor">โดย {actorDisplay}</div>
                    {entry.event_type === 'PAYMENT_REJECTED' && entry.metadata?.reject_reason && (
                      <div className="trail-reject-reason">
                        [เหตุผล: {REJECT_REASON_LABELS[entry.metadata.reject_reason]}]
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payment card (reference-style: slip left + info rows right) ──────────────

function PaymentCard({
  payment,
  allAuditTrail,
  onOpenSlip,
}: {
  payment: Payment;
  allAuditTrail: AuditTrailEntry[];
  onOpenSlip: (s: Slip) => void;
}) {
  const slips = payment.slips ?? [];
  const slip = slips[0];
  const hasSlip = slip != null &&
    (payment.payment_channel === 'BANK_TRANSFER' || payment.payment_channel === 'CREDIT');
  const refunds = payment.refunds ?? [];

  const reviewEvent = allAuditTrail.find(
    e => e.payment_id === payment.payment_id &&
      (e.event_type === 'PAYMENT_COMPLETED' || e.event_type === 'PAYMENT_REJECTED'),
  );
  const showReviewedBy = payment.payment_status === 'COMPLETED' || payment.payment_status === 'REJECTED';
  const showRejectReason = payment.payment_status === 'REJECTED';

  type InfoRow = { label: string; value: React.ReactNode; highlight?: boolean; reject?: boolean };
  const rows: InfoRow[] = [];

  rows.push({ label: 'ยอดเงิน', value: `฿${formatAmount(payment.amount)}`, highlight: true });

  if (payment.transfer_time) {
    rows.push({ label: 'เวลาโอน', value: formatDateTime(payment.transfer_time) });
  }
  if (slip?.bank_name) {
    rows.push({ label: 'บัญชีรับ', value: slip.bank_name });
  }
  if (slip?.account_holder) {
    rows.push({ label: 'ชื่อบัญชี', value: slip.account_holder });
  }
  if (slip?.account_number) {
    rows.push({ label: 'เลขบัญชีที่รับเงิน', value: slip.account_number });
  }
  if (slip?.uploaded_at) {
    rows.push({ label: 'วันที่อัปโหลดสลิป', value: formatDateTime(slip.uploaded_at) });
  }
  if (showReviewedBy && reviewEvent?.operator_name) {
    const actor = `${reviewEvent.operator_name}${reviewEvent.operator_role ? ` · ${reviewEvent.operator_role}` : ''}`;
    rows.push({ label: 'ดำเนินการโดย', value: actor });
  }
  if (showReviewedBy && reviewEvent?.created_at) {
    rows.push({ label: 'ดำเนินการเมื่อ', value: formatDateTime(reviewEvent.created_at) });
  }
  if (showRejectReason && reviewEvent?.metadata?.reject_reason) {
    rows.push({
      label: 'เหตุผลที่ปฏิเสธ',
      value: REJECT_REASON_LABELS[reviewEvent.metadata.reject_reason],
      reject: true,
    });
  }

  return (
    <div className="pc3-card">
      {/* Header */}
      <div className="pc3-header">
        <ChannelIcon channel={payment.payment_channel} />
        <div className="pc3-header-meta">
          <span className="pc3-seq">#{payment.seq}</span>
          <span className="pc3-channel">ชำระโดย {CHANNEL_LABELS[payment.payment_channel]}</span>
        </div>
        <div className="pc3-header-right">
          <PaymentStatusBadge status={payment.payment_status} />
        </div>
      </div>

      {/* Body */}
      <div className={`pc3-body${hasSlip ? ' pc3-body--with-slip' : ''}`}>
        {hasSlip && slip && (
          <div className="pc3-slip-col">
            <img
              src={slip.image_url}
              alt="สลิป"
              className="pc3-slip-img"
              onClick={() => onOpenSlip(slip)}
            />
            <button className="pc3-slip-expand-btn" onClick={() => onOpenSlip(slip)}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
              ขยายดูสลิป
            </button>
          </div>
        )}

        <div className="pc3-info-col">
          {rows.map((row, i) => (
            <div key={i} className={`pc3-info-row${row.reject ? ' pc3-info-row--reject' : ''}`}>
              <span className="pc3-info-label">{row.label}</span>
              <span className={`pc3-info-value${row.highlight ? ' pc3-info-value--highlight' : ''}${row.reject ? ' pc3-info-value--reject' : ''}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Refund strips */}
      {refunds.length > 0 && (
        <div className="pc3-refunds">
          {refunds.map(r => <RefundStrip key={r.refund_id} refund={r} />)}
        </div>
      )}

    </div>
  );
}

// ── Section 6: Vertical Timeline ─────────────────────────────────────────────

const STATE_TO_EVENT: Partial<Record<TransactionStatus, EventType>> = {
  PENDING:   'TRANSACTION_CREATED',
  CLOSED:    'TRANSACTION_CLOSED',
  SETTLED:   'TRANSACTION_SETTLED',
  COMPLETED: 'TRANSACTION_SETTLED',
  CANCELLED: 'TRANSACTION_CANCELLED',
  EXPIRED:   'TRANSACTION_EXPIRED',
  FAILED:    'TRANSACTION_VOIDED',
};

function VerticalTimeline({
  entries,
  auditTrail,
  payments,
}: {
  entries: StateHistoryEntry[];
  auditTrail: AuditTrailEntry[];
  payments: Payment[];
}) {
  if (!entries.length) return <div className="vtimeline-empty">ไม่มีข้อมูล</div>;

  // Build payment index map for refund event labels
  const paymentSeqMap = new Map<string, number>();
  payments.forEach(p => paymentSeqMap.set(p.payment_id, p.seq));

  // Collect refund events from audit trail to show in timeline
  const refundAuditEvents = auditTrail.filter(
    a => a.event_type === 'PAYMENT_REFUND_REQUESTED' || a.event_type === 'PAYMENT_REFUNDED',
  );

  type TimelineItem =
    | { kind: 'state'; entry: StateHistoryEntry; idx: number }
    | { kind: 'refund'; audit: AuditTrailEntry };

  const items: TimelineItem[] = [
    ...entries.map((entry, idx) => ({ kind: 'state' as const, entry, idx })),
    ...refundAuditEvents.map(audit => ({ kind: 'refund' as const, audit })),
  ].sort((a, b) => {
    const aTime = a.kind === 'state' ? new Date(a.entry.at).getTime() : new Date(a.audit.created_at).getTime();
    const bTime = b.kind === 'state' ? new Date(b.entry.at).getTime() : new Date(b.audit.created_at).getTime();
    return aTime - bTime;
  });

  return (
    <div className="vtimeline">
      {items.map((item, listIdx) => {
        const isLast = listIdx === items.length - 1;

        if (item.kind === 'state') {
          const { entry } = item;
          const expectedEvent = STATE_TO_EVENT[entry.to_state];
          const audit = expectedEvent ? auditTrail.find(a => a.event_type === expectedEvent) : undefined;
          const actor = entry.by
            ?? (audit?.operator_type === 'system' ? 'ระบบ' : audit?.operator_name)
            ?? null;
          return (
            <div key={`state-${item.idx}`} className="vtimeline-item">
              <div className="vtimeline-dot-col">
                <div className="vtimeline-dot" />
                {!isLast && <div className="vtimeline-line" />}
              </div>
              <div className="vtimeline-content">
                <TxStatusBadge status={entry.to_state} />
                <div className="vtimeline-time">{formatDateTime(entry.at)}</div>
                {actor && <div className="vtimeline-actor">โดย {actor}</div>}
              </div>
            </div>
          );
        }

        // refund event
        const { audit } = item;
        const seq = audit.payment_id ? paymentSeqMap.get(audit.payment_id) : undefined;
        const isRequested = audit.event_type === 'PAYMENT_REFUND_REQUESTED';
        const actor = audit.operator_type === 'system' ? 'ระบบ' : (audit.operator_name ?? '—');
        return (
          <div key={`refund-${audit.id}`} className="vtimeline-item vtimeline-item--refund">
            <div className="vtimeline-dot-col">
              <div className="vtimeline-dot vtimeline-dot--refund" />
              {!isLast && <div className="vtimeline-line" />}
            </div>
            <div className="vtimeline-content">
              <span className="vtimeline-refund-badge">
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                {isRequested ? 'ส่งคำขอคืนเงิน' : 'โอนเงินคืนสำเร็จ'}
                {seq != null && ` (รายการที่ ${seq})`}
              </span>
              {audit.metadata?.refund_amount && (
                <div className="vtimeline-refund-amount">฿{formatAmount(audit.metadata.refund_amount)}</div>
              )}
              <div className="vtimeline-time">{formatDateTime(audit.created_at)}</div>
              <div className="vtimeline-actor">โดย {actor}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section 7: Audit log table ───────────────────────────────────────────────

function AuditLogTable({
  auditTrail,
  payments,
}: {
  auditTrail: AuditTrailEntry[];
  payments: Payment[];
}) {
  if (!auditTrail.length) {
    return <div className="audit-log-empty">ยังไม่มีประวัติการดำเนินการ</div>;
  }

  const paymentIndexMap = new Map<string, number>();
  payments.forEach(p => paymentIndexMap.set(p.payment_id, p.seq));

  return (
    <div className="audit-log-table-wrap">
      <table className="audit-log-table">
        <thead>
          <tr>
            <th>วันที่/เวลา</th>
            <th>เหตุการณ์</th>
            <th>ผู้ดำเนินการ</th>
            <th>บทบาท</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {auditTrail.map(entry => {
            const isSystem = entry.operator_type === 'system';
            const payIdx = entry.payment_id ? paymentIndexMap.get(entry.payment_id) : undefined;
            const isPaymentEvent = PAYMENT_LEVEL_EVENTS.has(entry.event_type);
            const eventLabel = (EVENT_LABELS[entry.event_type] ?? entry.event_type) +
              (isPaymentEvent && payIdx != null ? ` (รายการที่ ${payIdx})` : '');

            const isRefundRow = entry.event_type === 'PAYMENT_REFUND_REQUESTED' || entry.event_type === 'PAYMENT_REFUNDED';

            let noteCell: React.ReactNode = '—';
            if (entry.event_type === 'PAYMENT_REJECTED' && entry.metadata?.reject_reason) {
              noteCell = REJECT_REASON_LABELS[entry.metadata.reject_reason];
            } else if (isRefundRow && entry.metadata?.refund_amount) {
              noteCell = (
                <span className="audit-refund-note">
                  ฿{formatAmount(entry.metadata.refund_amount)}
                  {entry.metadata.refund_bank_name && ` → ${entry.metadata.refund_bank_name}`}
                  {entry.metadata.refund_account_name && ` · ${entry.metadata.refund_account_name}`}
                </span>
              );
            }

            return (
              <tr key={entry.id} className={isRefundRow ? 'audit-row--refund' : ''}>
                <td className="audit-log-datetime">{formatDateTime(entry.created_at)}</td>
                <td>{eventLabel}</td>
                <td>{isSystem ? 'ระบบ' : (entry.operator_name ?? '—')}</td>
                <td>{isSystem ? '—' : (entry.operator_role ?? '—')}</td>
                <td>{noteCell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Collapsible audit log section ────────────────────────────────────────────

function CollapsibleAuditSection({
  auditTrail,
  payments,
}: {
  auditTrail: AuditTrailEntry[];
  payments: Payment[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="detail-section">
      <button className="audit-section-toggle" onClick={() => setOpen(o => !o)}>
        <span className={`audit-section-chevron${open ? ' open' : ''}`}>▼</span>
        ประวัติการดำเนินการ
        <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)' }}>
          ({auditTrail.length} รายการ)
        </span>
      </button>
      {open && <AuditLogTable auditTrail={auditTrail} payments={payments} />}
    </div>
  );
}

// ── Payment Summary widget ────────────────────────────────────────────────────

function PaymentSummary({ tx, payments }: { tx: Transaction; payments: Payment[] }) {
  const orderTotal = tx.order_total ?? tx.amount;
  const completedTotal = payments.filter(p => p.payment_status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
  const reviewTotal = payments.filter(p => p.payment_status === 'UNDER_REVIEW').reduce((s, p) => s + p.amount, 0);
  const remaining = orderTotal - completedTotal;
  const totalRefunded = payments.flatMap(p => p.refunds ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="detail-info-card">
      <div className="detail-card-title">สรุปยอดชำระ</div>
      <div className="pay-sum-row">
        <span className="pay-sum-label">ยอดรวมออร์เดอร์</span>
        <span className="pay-sum-value">฿{formatAmount(orderTotal)}</span>
      </div>
      <div className="pay-sum-row">
        <span className="pay-sum-label">ชำระแล้ว</span>
        <span className="pay-sum-value pay-sum-paid">฿{formatAmount(completedTotal)}</span>
      </div>
      {reviewTotal > 0 && (
        <div className="pay-sum-row">
          <span className="pay-sum-label">รอตรวจสอบ</span>
          <span className="pay-sum-value pay-sum-review">฿{formatAmount(reviewTotal)}</span>
        </div>
      )}
      {totalRefunded > 0 && (
        <div className="pay-sum-row">
          <span className="pay-sum-label">คืนเงินแล้ว</span>
          <span className="pay-sum-value pay-sum-refunded">−฿{formatAmount(totalRefunded)}</span>
        </div>
      )}
      <div className="pay-sum-divider" />
      <div className="pay-sum-row">
        <span className={`pay-sum-label${remaining <= 0 ? ' pay-sum-done-label' : ''}`}>
          {remaining > 0 ? 'คงเหลือ' : remaining < 0 ? 'ชำระเกิน' : 'ชำระครบแล้ว'}
        </span>
        <span className={`pay-sum-value ${remaining < 0 ? 'pay-sum-over' : remaining === 0 ? 'pay-sum-done' : 'pay-sum-remain'}`}>
          {remaining === 0 ? '✓ ครบแล้ว' : `฿${formatAmount(Math.abs(remaining))}`}
        </span>
      </div>
    </div>
  );
}

// ── Helper: derive payments list for detail view ─────────────────────────────

function getDetailPayments(tx: Transaction): Payment[] {
  if (tx.payments && tx.payments.length > 0) return tx.payments;
  return [{
    payment_id: `${tx.transaction_id}-pay-1`,
    seq: 1,
    payment_channel: tx.payment_channel,
    bank_name: tx.bank_name,
    transfer_time: tx.transfer_time,
    amount: tx.amount,
    payment_status: tx.payment_status,
    slip_count: tx.slip_count,
    slips: tx.slips,
    slip_id: tx.slips?.[0]?.slip_id,
    account_holder: tx.slips?.[0]?.account_holder,
  }];
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`toast toast--${type}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {type === 'success'
          ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        }
      </span>
      {message}
      <button className="toast-close" onClick={onDismiss} aria-label="ปิด">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TransactionDetailPage() {
  const params = useParams();
  const transactionNo = decodeURIComponent(params.transaction_no as string);
  const tx = INITIAL_TRANSACTIONS.find(t => t.transaction_no === transactionNo);

  const [activeSlip, setActiveSlip] = useState<Slip | null>(null);

  // ── Local mutable state (supports refund + void operations) ──────────────
  const [localPayments, setLocalPayments] = useState<Payment[]>([]);
  const [localAuditTrail, setLocalAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [localTxStatus, setLocalTxStatus] = useState<TransactionStatus>(tx?.transaction_status ?? 'PENDING');
  const [localStateHistory, setLocalStateHistory] = useState<StateHistoryEntry[]>([]);

  useEffect(() => {
    if (tx) {
      setLocalPayments(getDetailPayments(tx));
      setLocalAuditTrail(tx.audit_trail ?? []);
      setLocalTxStatus(tx.transaction_status);
      setLocalStateHistory(tx.state_history ?? []);
    }
  }, [tx?.transaction_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Overpay decision state ─────────────────────────────────────────────────
  type OverpayDecision = 'pending' | 'all_refunded' | 'acknowledged';

  const overpayDelta = tx?.overpay_delta ?? 0;

  const totalRefunded = localPayments.flatMap(p => p.refunds ?? []).reduce((s, r) => s + r.amount, 0);
  const remainingToRefund = Math.max(0, overpayDelta - totalRefunded);

  const initDecision = useCallback((): OverpayDecision => {
    if (!tx?.overpay_delta) return 'pending';
    if (tx.overpay_acknowledged) return 'acknowledged';
    return 'pending';
  }, [tx?.overpay_delta, tx?.overpay_acknowledged]);

  const [overpayDecision, setOverpayDecision] = useState<OverpayDecision>(initDecision);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundCancelMode, setRefundCancelMode] = useState(false);
  const [refundPreselectedPaymentId, setRefundPreselectedPaymentId] = useState<string | undefined>(undefined);
  const [refundPreFilledReason, setRefundPreFilledReason] = useState<string | undefined>(undefined);
  const [showTipDialog, setShowTipDialog]           = useState(false);
  const [showVoidDialog, setShowVoidDialog]           = useState(false);
  const [voidIsOmsCancelled, setVoidIsOmsCancelled]   = useState(false);
  const [voidPreFilledReason, setVoidPreFilledReason] = useState<string | undefined>(undefined);
  const [voidOrderNo, setVoidOrderNo]                 = useState<string | undefined>(undefined);
  const [showVoidBTDialog, setShowVoidBTDialog]       = useState(false);
  const [bodyTab, setBodyTab]                   = useState<'payments' | 'history'>('payments');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') =>
    setToast({ msg, type });

  // ยกเลิกออเดอร์ — PENDING/CLOSED/SETTLED with at least one COMPLETED payment
  const canCancelOrder =
    (localTxStatus === 'PENDING' || localTxStatus === 'CLOSED' || localTxStatus === 'SETTLED') &&
    localPayments.some(p => p.payment_status === 'COMPLETED');

  // PENDING/CLOSED + all CASH → CashVoid (reason + cash confirm)
  // PENDING/CLOSED + any BankTransfer → BankTransferVoid (reason + Finance Task)
  // SETTLED → RefundDialog (post-settlement, bank details required)
  function handleCancelOrder() {
    const isPendingOrClosed = localTxStatus === 'PENDING' || localTxStatus === 'CLOSED';
    const completedPayments = localPayments.filter(p => p.payment_status === 'COMPLETED');
    const allCash = completedPayments.length > 0 && completedPayments.every(p => p.payment_channel === 'CASH');

    if (isPendingOrClosed && allCash) {
      setVoidPreFilledReason(undefined);
      setVoidOrderNo(undefined);
      setShowVoidDialog(true);
    } else if (isPendingOrClosed) {
      setShowVoidBTDialog(true);
    } else {
      // SETTLED
      setRefundPreselectedPaymentId(undefined);
      setRefundCancelMode(true);
      setRefundPreFilledReason(undefined);
      setShowRefundDialog(true);
    }
  }

  // PAT-2038: handle void success
  function handleVoidSuccess(reason: string) {
    setShowVoidDialog(false);

    // OMS-cancelled: tx is already CANCELLED — just confirm cash was returned
    if (voidIsOmsCancelled) {
      setVoidIsOmsCancelled(false);
      setVoidPreFilledReason(undefined);
      setLocalPayments(prev => prev.map(p => ({ ...p, payment_status: 'VOIDED' as const })));
      setLocalAuditTrail(prev => [
        {
          id: `audit-oms-void-${Date.now()}`,
          transaction_id: tx!.transaction_id,
          event_type: 'TRANSACTION_VOIDED' as const,
          operator_type: 'user' as const,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      showToast('ยืนยันการคืนเงินสดเรียบร้อย');
      return;
    }

    // SukiPay-initiated void: PENDING/CLOSED → VOID_PREPARED → VOID (simulate async)
    const fromState = localTxStatus;
    setLocalTxStatus('VOID_PREPARED');
    const now = new Date().toISOString();
    setLocalStateHistory(prev => [...prev, { from_state: fromState, to_state: 'VOID_PREPARED', at: now }]);

    setTimeout(() => {
      const doneAt = new Date().toISOString();
      setLocalTxStatus('VOID');
      setLocalPayments(prev => prev.map(p => ({ ...p, payment_status: 'VOIDED' as const })));
      setLocalStateHistory(prev => [...prev, { from_state: 'VOID_PREPARED', to_state: 'VOID', at: doneAt }]);
      setLocalAuditTrail(prev => [
        {
          id: `audit-void-${Date.now()}`,
          transaction_id: tx!.transaction_id,
          event_type: 'TRANSACTION_VOIDED' as const,
          operator_type: 'system' as const,
          created_at: doneAt,
        },
        {
          id: `audit-void-oms-${Date.now()}`,
          transaction_id: tx!.transaction_id,
          event_type: 'OMS_NOTIFIED' as const,
          operator_type: 'system' as const,
          created_at: doneAt,
        },
        ...prev,
      ]);
      setVoidOrderNo(undefined);
      setVoidPreFilledReason(undefined);
      showToast('ยกเลิกการชำระสำเร็จ — สามารถบันทึกรับเงินใหม่ได้');
    }, 1200);
  }

  // BankTransfer Void: PENDING/CLOSED → VOID_PREPARED → VOID, BT payments → REFUND_PENDING
  function handleVoidBTSuccess(_reason: string) {
    setShowVoidBTDialog(false);

    // Flip all completed BT payments to REFUND_PENDING immediately
    setLocalPayments(prev =>
      prev.map(p =>
        p.payment_channel === 'BANK_TRANSFER' && p.payment_status === 'COMPLETED'
          ? { ...p, payment_status: 'REFUND_PENDING' as const }
          : p,
      ),
    );

    const fromState = localTxStatus;
    setLocalTxStatus('VOID_PREPARED');
    const now = new Date().toISOString();
    setLocalStateHistory(prev => [...prev, { from_state: fromState, to_state: 'VOID_PREPARED', at: now }]);

    setTimeout(() => {
      const doneAt = new Date().toISOString();
      setLocalTxStatus('VOID');
      setLocalStateHistory(prev => [...prev, { from_state: 'VOID_PREPARED', to_state: 'VOID', at: doneAt }]);
      setLocalAuditTrail(prev => [
        {
          id: `audit-voidbt-${Date.now()}`,
          transaction_id: tx!.transaction_id,
          event_type: 'TRANSACTION_VOIDED' as const,
          operator_type: 'system' as const,
          created_at: doneAt,
        },
        {
          id: `audit-voidbt-oms-${Date.now()}`,
          transaction_id: tx!.transaction_id,
          event_type: 'OMS_NOTIFIED' as const,
          operator_type: 'system' as const,
          created_at: doneAt,
        },
        ...prev,
      ]);
      showToast('ยกเลิกการชำระสำเร็จ — Finance Manager จะดำเนินการโอนคืน');
    }, 1200);
  }

  // Eligible payments for refund — COMPLETED payments qualify for standard flow
  // OMS-cancelled: also include REFUND_PENDING payments (system auto-created refund request)
  // CASH payments have no pre-filled bank info; Finance Manager enters destination account
  const isOmsCancelled = !!tx?.cancellation_reason;
  const eligiblePayments: EligiblePayment[] = localPayments
    .filter(p => p.payment_status === 'COMPLETED' || (isOmsCancelled && p.payment_status === 'REFUND_PENDING'))
    .map(p => ({
      payment_id: p.payment_id,
      seq: p.seq,
      amount: p.amount,
      payment_channel: p.payment_channel,
      bank_name: p.bank_name,
      account_number: p.slips?.[0]?.account_number,
      refunds: p.refunds,
    }));

  const hasOverpay =
    overpayDelta > 0 &&
    remainingToRefund > 0 &&
    overpayDecision !== 'acknowledged';

  // ── Open refund dialog from OverpayBanner (always overpay mode, not cancel) ──
  function handleOpenRefund(paymentId?: string) {
    setRefundPreselectedPaymentId(paymentId);
    setRefundCancelMode(false);
    setRefundPreFilledReason(undefined);
    setShowRefundDialog(true);
  }

  // ── Open correct dialog from OMS-cancelled banner ──────────────────────────
  // - CLOSED + all CASH → VoidDialog (คืนเงินสดหน้าร้าน, ยืนยัน checkbox)
  // - CLOSED + BANK_TRANSFER หรือ SETTLED + ทุก channel → RefundDialog (โอนธนาคาร)
  function handleOmsCancelledRefund() {
    const preCancelStatus = tx?.state_history?.find(h => h.to_state === 'CANCELLED')?.from_state;
    const isClosedAllCash =
      preCancelStatus === 'CLOSED' &&
      localPayments.length > 0 &&
      localPayments.every(p => p.payment_channel === 'CASH');

    if (isClosedAllCash) {
      setVoidIsOmsCancelled(true);
      setVoidPreFilledReason(
        CANCELLATION_REASON_LABELS[tx?.cancellation_reason ?? ''] ?? tx?.cancellation_reason,
      );
      setShowVoidDialog(true);
    } else {
      setRefundPreselectedPaymentId(undefined);
      setRefundCancelMode(true);
      setRefundPreFilledReason(tx?.cancellation_reason);
      setShowRefundDialog(true);
    }
  }

  // ── Refund dialog success ──────────────────────────────────────────────────
  function handleRefundSuccess(result: RefundSubmitResult) {
    const now = new Date().toISOString();

    // Add refund record to the payment
    setLocalPayments(prev =>
      prev.map(p =>
        p.payment_id === result.paymentId
          ? { ...p, refunds: [...(p.refunds ?? []), result.record] }
          : p,
      ),
    );

    // Add audit entries: PAYMENT_REFUND_REQUESTED + PAYMENT_REFUNDED
    const requestedEntry: AuditTrailEntry = {
      id: `audit-new-${Math.random().toString(36).slice(2, 8)}`,
      transaction_id: tx!.transaction_id,
      payment_id: result.paymentId,
      event_type: 'PAYMENT_REFUND_REQUESTED',
      operator_type: 'user',
      operator_name: result.record.requested_by,
      operator_role: 'Finance Manager',
      metadata: {
        refund_amount: result.record.amount,
        refund_bank_name: result.record.bank_name,
        refund_account_number: result.record.account_number,
        refund_account_name: result.record.account_name,
        refund_note: result.record.note,
      },
      created_at: result.record.requested_at,
    };
    const refundedEntry: AuditTrailEntry = {
      id: `audit-new-${Math.random().toString(36).slice(2, 8)}`,
      transaction_id: tx!.transaction_id,
      payment_id: result.paymentId,
      event_type: 'PAYMENT_REFUNDED',
      operator_type: 'system',
      metadata: {
        refund_amount: result.record.amount,
        refund_bank_name: result.record.bank_name,
        refund_account_number: result.record.account_number,
        refund_account_name: result.record.account_name,
      },
      created_at: result.record.completed_at ?? now,
    };

    setLocalAuditTrail(prev =>
      [...prev, requestedEntry, refundedEntry].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    );

    setShowRefundDialog(false);

    // Check if fully refunded
    const newTotal = totalRefunded + result.record.amount;
    if (newTotal >= overpayDelta - 0.01) {
      setOverpayDecision('all_refunded');
      showToast('คืนเงินครบแล้ว ฿' + formatAmount(overpayDelta));
    } else {
      showToast('ส่งคำขอคืนเงิน ฿' + formatAmount(result.record.amount) + ' สำเร็จ');
    }
  }

  // ── Tip dialog handlers ────────────────────────────────────────────────────
  function handleTipSuccess() {
    setShowTipDialog(false);
    setOverpayDecision('acknowledged');
    showToast('บันทึก Tip เรียบร้อย');
  }

  if (!tx) {
    return (
      <div className="sellsuki-app">
        <TopNavbar pollCount={0} isPolling={false} />
        <div className="app-body">
          <Sidebar />
          <main className="app-content">
            <div className="detail-not-found">
              <div className="detail-not-found-icon">🔍</div>
              <div className="detail-not-found-title">ไม่พบ Transaction</div>
              <div className="detail-not-found-sub">{transactionNo}</div>
              <Link href="/transactions" className="btn-back" style={{ marginTop: 16 }}>
                ← กลับไปรายการธุรกรรม
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const stateHistory = localStateHistory;

  const overpayBannerDecision =
    overpayDecision === 'acknowledged'
      ? 'acknowledged'
      : overpayDecision === 'all_refunded'
        ? 'refund_pending'
        : 'pending';

  return (
    <div className="sellsuki-app">
      <TopNavbar pollCount={0} isPolling={false} />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">

          {/* ── Page Header ── */}
          <div className="detail-page-header">
            <div className="detail-page-nav">
              <Link href="/transactions" className="btn-back">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                รายการธุรกรรม
              </Link>
              <span className="detail-page-created">{formatDateTime(tx.created_at)}</span>
            </div>

            <div className="detail-page-title-row">
              <div className="detail-page-title-left">
                <span className="detail-page-entity-label">ธุรกรรม</span>
                <span className="detail-tx-no">{tx.transaction_no}</span>
                <TxStatusBadge status={localTxStatus} />
              </div>
              <div className="detail-page-title-right">
                <span className="detail-page-amount">฿{formatAmount(tx.amount)}</span>
                {canCancelOrder && (
                  <button
                    type="button"
                    className="detail-void-btn"
                    onClick={handleCancelOrder}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    ยกเลิกออเดอร์
                  </button>
                )}
              </div>
            </div>

            <div className="detail-page-order-row">
              Order: <span className="detail-order-no">{tx.order_serial ?? tx.order_no}</span>
            </div>
          </div>

          {/* ── PAT-2036: Overpay Banner ── */}
          {(hasOverpay || overpayDecision === 'all_refunded' || (totalRefunded > 0 && overpayDecision !== 'acknowledged')) && (
            <OverpayBanner
              overpayDelta={overpayDelta}
              paidAmount={tx.amount}
              orderTotal={tx.order_total ?? tx.amount - overpayDelta}
              totalRefunded={totalRefunded}
              decision={overpayBannerDecision}
              onClickRefund={() => handleOpenRefund(undefined)}
              onClickTip={() => setShowTipDialog(true)}
            />
          )}

          {/* ── OMS-cancelled + Refund Pending Banner ── */}
          {tx.transaction_status === 'CANCELLED' && tx.payment_status === 'REFUND_PENDING' && tx.cancellation_reason && (
            <div className="overpay-banner overpay-banner--refund-pending" role="status">
              <div className="overpay-banner-icon overpay-banner-icon--refund-pending">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </div>
              <div className="overpay-banner-body">
                <div className="overpay-banner-title overpay-banner-title--refund-pending">
                  ถูกยกเลิกโดย OMS — รอดำเนินการคืนเงิน ฿{formatAmount(tx.amount)}
                </div>
                <div className="overpay-banner-subtitle">
                  <span>
                    เหตุผล: <strong>{CANCELLATION_REASON_LABELS[tx.cancellation_reason] ?? tx.cancellation_reason}</strong>
                  </span>
                  {tx.cancellation_note && (
                    <span> · หมายเหตุ: {tx.cancellation_note}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="overpay-banner-action-btn"
                onClick={handleOmsCancelledRefund}
              >
                ดำเนินการคืนเงิน
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}

          {/* ── Non-OMS Cancelled + Refund Pending Banner (legacy) ── */}
          {tx.transaction_status === 'CANCELLED' && tx.payment_status === 'REFUND_PENDING' && !tx.cancellation_reason && (
            <div className="overpay-banner overpay-banner--refund-pending" role="status">
              <div className="overpay-banner-icon overpay-banner-icon--refund-pending">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </div>
              <div className="overpay-banner-body">
                <div className="overpay-banner-title overpay-banner-title--refund-pending">
                  รอดำเนินการคืนเงิน — ฿{formatAmount(tx.amount)}
                </div>
                <div className="overpay-banner-subtitle">
                  Order นี้ถูกยกเลิก — ระบบสร้างคำขอคืนเงินให้อัตโนมัติแล้ว รอ Finance ดำเนินการโอนคืน
                </div>
              </div>
            </div>
          )}

          {/* ── OMS-cancelled ก่อนชำระ — แสดงเหตุผล ไม่ต้องคืนเงิน ── */}
          {tx.transaction_status === 'CANCELLED' && tx.payment_status !== 'REFUND_PENDING' && tx.cancellation_reason && (
            <div className="overpay-banner overpay-banner--cancelled-info" role="status">
              <div className="overpay-banner-icon overpay-banner-icon--cancelled-info">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                </svg>
              </div>
              <div className="overpay-banner-body">
                <div className="overpay-banner-title overpay-banner-title--cancelled-info">
                  ถูกยกเลิกโดย OMS — ไม่มีการชำระเงิน
                </div>
                <div className="overpay-banner-subtitle">
                  <span>
                    เหตุผล: <strong>{CANCELLATION_REASON_LABELS[tx.cancellation_reason] ?? tx.cancellation_reason}</strong>
                  </span>
                  {tx.cancellation_note && (
                    <span> · หมายเหตุ: {tx.cancellation_note}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Dashboard ── */}
          <div className="detail-dashboard">

            {/* ── Main Content ── */}
            <div className="detail-main">

              {/* Tab bar */}
              <div className="body-tabs">
                <button
                  className={`body-tab${bodyTab === 'payments' ? ' body-tab--active' : ''}`}
                  onClick={() => setBodyTab('payments')}
                >
                  รายการชำระ
                  {localPayments.length > 0 && (
                    <span className="body-tab-badge">{localPayments.length}</span>
                  )}
                </button>
                <button
                  className={`body-tab${bodyTab === 'history' ? ' body-tab--active' : ''}`}
                  onClick={() => setBodyTab('history')}
                >
                  ประวัติการดำเนินการ
                  {localAuditTrail.length > 0 && (
                    <span className="body-tab-badge">{localAuditTrail.length}</span>
                  )}
                </button>
              </div>

              {/* Payments tab */}
              {bodyTab === 'payments' && (
                <div className="body-tab-content">
                  {localPayments.map(payment => (
                    <PaymentCard
                      key={payment.payment_id}
                      payment={payment}
                      allAuditTrail={localAuditTrail}
                      onOpenSlip={setActiveSlip}
                    />
                  ))}
                </div>
              )}

              {/* History tab */}
              {bodyTab === 'history' && (
                <div className="body-tab-content">
                  <AuditLogTable auditTrail={localAuditTrail} payments={localPayments} />
                </div>
              )}
            </div>

            {/* ── Right Sidebar ── */}
            <aside className="detail-sidebar">
              <PaymentSummary tx={tx} payments={localPayments} />


              <div className="detail-info-card">
                <div className="detail-card-title">ข้อมูลลูกค้า</div>
                <InfoRow label="ชื่อลูกค้า" value={tx.customer?.name} />
                <InfoRow label="ช่องทางติดต่อ" value={tx.customer?.contact} />
                <InfoRow label="ร้านค้า / บริษัท" value={tx.customer?.company_name} />
              </div>

              <div className="detail-info-card">
                <div className="detail-card-title">สถานะไทม์ไลน์</div>
                <div className="vtimeline-card-body">
                  <VerticalTimeline
                    entries={stateHistory}
                    auditTrail={localAuditTrail}
                    payments={localPayments}
                  />
                </div>
              </div>
            </aside>

          </div>

        </main>
      </div>

      {/* ── Modals ── */}
      <SlipPreviewModal slip={activeSlip} onClose={() => setActiveSlip(null)} />

      <RefundDialog
        open={showRefundDialog}
        transactionId={tx.transaction_id}
        overpayDelta={overpayDelta}
        alreadyRefunded={totalRefunded}
        eligiblePayments={eligiblePayments}
        preSelectedPaymentId={refundPreselectedPaymentId}
        cancelMode={refundCancelMode}
        preFilledReason={refundPreFilledReason}
        onSuccess={handleRefundSuccess}
        onClose={() => setShowRefundDialog(false)}
        onClickTip={!refundCancelMode && overpayDelta > 0 ? () => {
          setShowRefundDialog(false);
          setShowTipDialog(true);
        } : undefined}
      />

      <TipConfirmDialog
        open={showTipDialog}
        transactionId={tx.transaction_id}
        overpayDelta={overpayDelta}
        onSuccess={handleTipSuccess}
        onClose={() => setShowTipDialog(false)}
      />

      <VoidDialog
        open={showVoidDialog}
        transactionId={tx.transaction_no}
        cashAmount={localPayments.filter(p => p.payment_channel === 'CASH').reduce((s, p) => s + p.amount, 0)}
        preFilledReason={voidPreFilledReason}
        orderNo={voidOrderNo}
        onSuccess={handleVoidSuccess}
        onClose={() => {
          setShowVoidDialog(false);
          setVoidIsOmsCancelled(false);
          setVoidPreFilledReason(undefined);
          setVoidOrderNo(undefined);
        }}
      />

      <VoidBTDialog
        open={showVoidBTDialog}
        transactionId={tx.transaction_no}
        btAmount={localPayments
          .filter(p => p.payment_channel === 'BANK_TRANSFER' && p.payment_status === 'COMPLETED')
          .reduce((s, p) => s + p.amount, 0)}
        onSuccess={handleVoidBTSuccess}
        onClose={() => setShowVoidBTDialog(false)}
      />

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
