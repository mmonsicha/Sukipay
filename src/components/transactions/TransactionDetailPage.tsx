'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopNavbar from '@/components/layout/TopNavbar';
import Sidebar from '@/components/layout/Sidebar';
import SlipPreviewModal from './SlipPreviewModal';
import { INITIAL_TRANSACTIONS } from '@/lib/mockData';
import type {
  Transaction, Payment, Slip,
  PaymentStatus, TransactionStatus, PaymentChannel,
  EventType, RejectReason, AuditTrailEntry, StateHistoryEntry,
} from '@/lib/types';

// ── Formatters ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  // Display in Asia/Bangkok (UTC+7)
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(d).replace(',', '');
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function maskAccount(acct: string): string {
  if (acct.length <= 4) return acct;
  return 'x'.repeat(acct.length - 4) + acct.slice(-4);
}

// ── Enum labels ──────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  BANK_TRANSFER: 'โอนเงินผ่านธนาคาร',
  CASH: 'เงินสด',
  CREDIT: 'บัตรเครดิต',
  COD: 'เก็บเงินปลายทาง (COD)',
};

const EVENT_LABELS: Record<EventType, string> = {
  PAYMENT_ADDED:               'อัปโหลดสลิป',
  PAYMENT_COMPLETED:           'อนุมัติการชำระเงิน',
  PAYMENT_REJECTED:            'ปฏิเสธการชำระเงิน',
  PAYMENT_DETAIL_EDITED:       'แก้ไขข้อมูลการชำระ',
  PAYMENT_REFUNDED:            'คืนเงินแล้ว',
  TRANSACTION_CREATED:         'สร้าง Transaction',
  TRANSACTION_CLOSED:          'ปิด Transaction (ชำระครบ)',
  TRANSACTION_SETTLED:         'ยืนยันการตัดบัญชี',
  TRANSACTION_AMOUNT_UPDATED:  'อัปเดตยอด Transaction',
  TRANSACTION_CANCELLED:       'ยกเลิก Transaction',
  TRANSACTION_EXPIRED:         'Transaction หมดอายุ',
  VOID_PREPARED:               'เตรียม Void',
  TRANSACTION_VOIDED:          'ยกเลิกการชำระ (Void)',
};

const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  AMOUNT_MISMATCH: 'ยอดเงินไม่ตรง',
  WRONG_ACCOUNT:   'บัญชีผิด',
  BLURRY_SLIP:     'สลิปไม่ชัด',
  DUPLICATE_SLIP:  'สลิปซ้ำ',
  WRONG_DATE:      'วันที่ผิด',
  OTHER:           'อื่นๆ',
};


// Payment-level events (for "(รายการที่ N)" suffix logic)
const PAYMENT_LEVEL_EVENTS = new Set<EventType>([
  'PAYMENT_ADDED', 'PAYMENT_COMPLETED', 'PAYMENT_REJECTED',
  'PAYMENT_DETAIL_EDITED', 'PAYMENT_REFUNDED',
]);

// ── Status badge configs ─────────────────────────────────────────────────────

const PS_CFG: Record<PaymentStatus, { cls: string; label: string }> = {
  PENDING:      { cls: 'badge-ps-pending',   label: 'รอชำระ' },
  UNDER_REVIEW: { cls: 'badge-ps-review',    label: 'รอตรวจสอบ' },
  COMPLETED:    { cls: 'badge-ps-completed', label: 'อนุมัติแล้ว' },
  REJECTED:     { cls: 'badge-ps-rejected',  label: 'ปฏิเสธ' },
  FAILED:       { cls: 'badge-ps-failed',    label: 'ล้มเหลว' },
  VOIDED:       { cls: 'badge-ps-failed',    label: 'ยกเลิก' },
  REFUNDED:     { cls: 'badge-ts-closed',    label: 'คืนเงิน' },
};

const TS_CFG: Record<TransactionStatus, { cls: string; label: string }> = {
  PENDING:   { cls: 'badge-ts-pending',   label: 'รอดำเนินการ' },
  CLOSED:    { cls: 'badge-ts-closed',    label: 'ชำระเงินแล้ว' },
  SETTLED:   { cls: 'badge-ts-settled',   label: 'สำเร็จแล้ว' },
  COMPLETED: { cls: 'badge-ts-completed', label: 'สำเร็จแล้ว' },
  CANCELLED: { cls: 'badge-ts-cancelled', label: 'ยกเลิก' },
  FAILED:    { cls: 'badge-ts-failed',    label: 'ล้มเหลว' },
  EXPIRED:   { cls: 'badge-ts-expired',   label: 'หมดอายุ' },
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { cls, label } = PS_CFG[status] ?? { cls: 'badge-ps-pending', label: status };
  return <span className={`status-badge ${cls}`}><span className="status-dot" />{label}</span>;
}

function TxStatusBadge({ status }: { status: TransactionStatus }) {
  const { cls, label } = TS_CFG[status] ?? { cls: 'badge-ts-pending', label: status };
  return <span className={`status-badge ${cls}`}><span className="status-dot" />{label}</span>;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

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

// ── Section 5: Slip inline panel ─────────────────────────────────────────────

function SlipPanel({
  payment,
  slips,
  onOpenFull,
}: {
  payment: Payment;
  slips: Slip[];
  onOpenFull: (s: Slip) => void;
}) {
  if (!slips.length) return null;
  const slip = slips[0];
  return (
    <div className="slip-inline-panel">
      <div className="slip-inline-header">
        <span className="slip-inline-title">หลักฐานการโอนเงิน</span>
        <button className="slip-view-btn" onClick={() => onOpenFull(slip)}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          ดูสลิป
        </button>
      </div>
      {/* Slip image thumbnail */}
      <div className="slip-compact-thumb-wrap" onClick={() => onOpenFull(slip)} title="คลิกเพื่อดูสลิปเต็ม">
        <img
          src={slip.image_url}
          alt="สลิปโอนเงิน"
          className="slip-compact-img"
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
        />
        <div className="slip-compact-overlay">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </div>
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

  // Filter entries for this payment, sort ASC (เก่าสุด → ใหม่สุด)
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

              return (
                <div key={entry.id} className="trail-entry">
                  <div className="trail-dot-col">
                    <div className="trail-dot" />
                    {!isLast && <div className="trail-line" />}
                  </div>
                  <div className="trail-content">
                    <div className="trail-datetime">{formatDateTime(entry.created_at)}</div>
                    <div className="trail-event-label">{EVENT_LABELS[entry.event_type] ?? entry.event_type}</div>
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

// ── Section 4: Payment card ───────────────────────────────────────────────────

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
  const hasSlipPanel = slips.length > 0 && (payment.payment_channel === 'BANK_TRANSFER' || payment.payment_channel === 'CREDIT');

  // Derive reviewed by/at from audit trail
  const reviewEvent = allAuditTrail.find(
    e => e.payment_id === payment.payment_id &&
      (e.event_type === 'PAYMENT_COMPLETED' || e.event_type === 'PAYMENT_REJECTED'),
  );
  const editEvent = allAuditTrail
    .filter(e => e.payment_id === payment.payment_id && e.event_type === 'PAYMENT_DETAIL_EDITED')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const showReviewedBy = payment.payment_status === 'COMPLETED' || payment.payment_status === 'REJECTED';
  const showRejectReason = payment.payment_status === 'REJECTED';
  const showLastEdited = !!editEvent;

  return (
    <div className="payment-card">
      {/* Card header */}
      <div className="payment-card-header">
        <span className="payment-card-seq">รายการที่ {payment.seq}</span>
        <PaymentStatusBadge status={payment.payment_status} />
      </div>

      {/* Payment fields grid */}
      <div className="payment-fields-grid">
        <div className="payment-field">
          <div className="payment-field-label">วิธีชำระเงิน</div>
          <div className="payment-field-value">{CHANNEL_LABELS[payment.payment_channel]}</div>
        </div>
        <div className="payment-field">
          <div className="payment-field-label">จำนวนเงิน</div>
          <div className="payment-field-value payment-field-amount">฿{formatAmount(payment.amount)}</div>
        </div>
        <div className="payment-field">
          <div className="payment-field-label">วันเวลาโอนเงิน</div>
          <div className="payment-field-value">
            {payment.transfer_time ? formatDateTime(payment.transfer_time) : <Empty />}
          </div>
        </div>
        <div className="payment-field">
          <div className="payment-field-label">วันเวลาอัปโหลด Slip</div>
          <div className="payment-field-value">
            {slips[0]?.uploaded_at ? formatDateTime(slips[0].uploaded_at) : <Empty />}
          </div>
        </div>

        {showReviewedBy && (
          <>
            <div className="payment-field">
              <div className="payment-field-label">ตรวจโดย</div>
              <div className="payment-field-value">
                {reviewEvent?.operator_name
                  ? `${reviewEvent.operator_name}${reviewEvent.operator_role ? ` (${reviewEvent.operator_role})` : ''}`
                  : <Empty />}
              </div>
            </div>
            <div className="payment-field">
              <div className="payment-field-label">วันเวลาตรวจ</div>
              <div className="payment-field-value">
                {reviewEvent?.created_at ? formatDateTime(reviewEvent.created_at) : <Empty />}
              </div>
            </div>
          </>
        )}

        {showRejectReason && (
          <div className="payment-field">
            <div className="payment-field-label">เหตุผลที่ปฏิเสธ</div>
            <div className="payment-field-value payment-field-reject">
              {reviewEvent?.metadata?.reject_reason
                ? REJECT_REASON_LABELS[reviewEvent.metadata.reject_reason]
                : <Empty />}
            </div>
          </div>
        )}

        {showLastEdited && (
          <>
            <div className="payment-field">
              <div className="payment-field-label">แก้ไขโดย</div>
              <div className="payment-field-value">
                {editEvent.operator_name
                  ? `${editEvent.operator_name}${editEvent.operator_role ? ` (${editEvent.operator_role})` : ''}`
                  : <Empty />}
              </div>
            </div>
            <div className="payment-field">
              <div className="payment-field-label">วันเวลาที่แก้ไขล่าสุด</div>
              <div className="payment-field-value">{formatDateTime(editEvent.created_at)}</div>
            </div>
          </>
        )}
      </div>

      {/* Section 5: Slip information panel */}
      {hasSlipPanel && (
        <SlipPanel payment={payment} slips={slips} onOpenFull={onOpenSlip} />
      )}

      {/* Per-payment audit trail */}
      <PerPaymentTrail
        paymentId={payment.payment_id}
        auditTrail={allAuditTrail}
      />
    </div>
  );
}

// ── State → event mapping for actor lookup ────────────────────────────────────
const STATE_TO_EVENT: Partial<Record<TransactionStatus, EventType>> = {
  PENDING:   'TRANSACTION_CREATED',
  CLOSED:    'TRANSACTION_CLOSED',
  SETTLED:   'TRANSACTION_SETTLED',
  COMPLETED: 'TRANSACTION_SETTLED',
  CANCELLED: 'TRANSACTION_CANCELLED',
  EXPIRED:   'TRANSACTION_EXPIRED',
  FAILED:    'TRANSACTION_VOIDED',
};

// ── Section 6: Vertical Timeline ─────────────────────────────────────────────

function VerticalTimeline({ entries, auditTrail }: { entries: StateHistoryEntry[]; auditTrail: AuditTrailEntry[] }) {
  if (!entries.length) return <div className="vtimeline-empty">ไม่มีข้อมูล</div>;
  return (
    <div className="vtimeline">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        const expectedEvent = STATE_TO_EVENT[entry.to_state];
        const audit = expectedEvent ? auditTrail.find(a => a.event_type === expectedEvent) : undefined;
        const actor = entry.by
          ?? (audit?.operator_type === 'system' ? 'ระบบ' : audit?.operator_name)
          ?? null;
        return (
          <div key={idx} className="vtimeline-item">
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
    return (
      <div className="audit-log-empty">ยังไม่มีประวัติการดำเนินการ</div>
    );
  }

  // Build payment index map for "(รายการที่ N)" label
  // Payments sorted by seq (already sequential)
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

            return (
              <tr key={entry.id}>
                <td className="audit-log-datetime">{formatDateTime(entry.created_at)}</td>
                <td>{eventLabel}</td>
                <td>{isSystem ? 'ระบบ' : (entry.operator_name ?? '—')}</td>
                <td>{isSystem ? '—' : (entry.operator_role ?? '—')}</td>
                <td>
                  {entry.event_type === 'PAYMENT_REJECTED' && entry.metadata?.reject_reason
                    ? REJECT_REASON_LABELS[entry.metadata.reject_reason]
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Payment Summary widget ────────────────────────────────────────────────────

function PaymentSummary({ tx, payments }: { tx: Transaction; payments: Payment[] }) {
  const orderTotal = tx.order_total ?? tx.amount;
  const completedTotal = payments.filter(p => p.payment_status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
  const reviewTotal = payments.filter(p => p.payment_status === 'UNDER_REVIEW').reduce((s, p) => s + p.amount, 0);
  const remaining = orderTotal - completedTotal;

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
  // Synthesize single payment from tx-level fields
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

// ── Main component ───────────────────────────────────────────────────────────

export default function TransactionDetailPage() {
  const params = useParams();
  const transactionNo = decodeURIComponent(params.transaction_no as string);
  const tx = INITIAL_TRANSACTIONS.find(t => t.transaction_no === transactionNo);

  const [activeSlip, setActiveSlip] = useState<Slip | null>(null);

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

  const payments = getDetailPayments(tx);
  const auditTrail = tx.audit_trail ?? [];
  const stateHistory = tx.state_history ?? [];

  return (
    <div className="sellsuki-app">
      <TopNavbar pollCount={0} isPolling={false} />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">

          {/* ── Back button ── */}
          <div className="detail-back-row">
            <Link href="/transactions" className="btn-back">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              รายการธุรกรรม
            </Link>
          </div>

          {/* ── Section 1: Transaction Header ── */}
          <div className="detail-header-card">
            <div className="detail-header-left">
              <div className="detail-tx-no">{tx.transaction_no}</div>
              <div className="detail-created-date">
                วันที่ทำรายการ: {formatDateTime(tx.created_at)}
              </div>
              <div className="detail-order-ref">
                Order: <span className="detail-order-no">{tx.order_serial ?? tx.order_no}</span>
              </div>
            </div>
            <div className="detail-header-right">
              <TxStatusBadge status={tx.transaction_status} />
              <div className="detail-amount-display">฿{formatAmount(tx.amount)}</div>
            </div>
          </div>

          {/* ── Dashboard: main + sidebar ── */}
          <div className="detail-dashboard">

            {/* ── Main Content (LEFT) ── */}
            <div className="detail-main">
              <div className="detail-section">
                <div className="detail-section-title">รายการชำระเงิน</div>
                {payments.map(payment => (
                  <PaymentCard
                    key={payment.payment_id}
                    payment={payment}
                    allAuditTrail={auditTrail}
                    onOpenSlip={setActiveSlip}
                  />
                ))}
              </div>

              <div className="detail-section">
                <div className="detail-section-title">ประวัติการดำเนินการ</div>
                <AuditLogTable auditTrail={auditTrail} payments={payments} />
              </div>
            </div>

            {/* ── Right Sidebar ── */}
            <aside className="detail-sidebar">
              <div className="detail-info-card">
                <div className="detail-card-title">ข้อมูลลูกค้า</div>
                <InfoRow label="ชื่อลูกค้า" value={tx.customer?.name} />
                <InfoRow label="ช่องทางติดต่อ" value={tx.customer?.contact} />
                <InfoRow label="ร้านค้า / บริษัท" value={tx.customer?.company_name} />
              </div>

              <PaymentSummary tx={tx} payments={payments} />

              <div className="detail-info-card">
                <div className="detail-card-title">สถานะไทม์ไลน์</div>
                <div className="vtimeline-card-body">
                  <VerticalTimeline entries={stateHistory} auditTrail={auditTrail} />
                </div>
              </div>
            </aside>

          </div>

        </main>
      </div>

      <SlipPreviewModal slip={activeSlip} onClose={() => setActiveSlip(null)} />
    </div>
  );
}
