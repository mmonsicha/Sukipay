'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Transaction, Slip, SortDirection, PaymentStatus, TransactionStatus, PaymentChannel } from '@/lib/types';
import SlipPreviewModal from './SlipPreviewModal';

// ── Formatters ──────────────────────────────────────────────────────────────

function formatThaiDate(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  BANK_TRANSFER: 'โอนผ่านธนาคาร',
  CASH: 'เงินสด',
  CREDIT: 'เครดิต',
  COD: 'COD',
};

// ── Status badge helpers ────────────────────────────────────────────────────

const PS_CFG: Record<PaymentStatus, { cls: string; label: string }> = {
  PENDING:        { cls: 'badge-ps-pending',        label: 'รอชำระ' },
  UNDER_REVIEW:   { cls: 'badge-ps-review',         label: 'รอตรวจสอบ' },
  COMPLETED:      { cls: 'badge-ps-completed',      label: 'ชำระแล้ว' },
  REJECTED:       { cls: 'badge-ps-rejected',       label: 'ปฏิเสธ' },
  FAILED:         { cls: 'badge-ps-failed',         label: 'ล้มเหลว' },
  VOIDED:         { cls: 'badge-ps-failed',         label: 'ยกเลิก' },
  REFUNDED:       { cls: 'badge-ts-closed',         label: 'คืนเงิน' },
  REFUND_PENDING: { cls: 'badge-ps-refund-pending', label: 'รอคืนเงิน' },
};

const TS_CFG: Record<TransactionStatus, { cls: string; label: string }> = {
  PENDING:       { cls: 'badge-ts-pending',        label: 'รอชำระ' },
  CLOSED:        { cls: 'badge-ts-closed',         label: 'ปิดยอด' },
  SETTLED:       { cls: 'badge-ts-settled',        label: 'สำเร็จ' },
  COMPLETED:     { cls: 'badge-ts-completed',      label: 'สำเร็จ' },
  CANCELLED:     { cls: 'badge-ts-cancelled',      label: 'ยกเลิก' },
  FAILED:        { cls: 'badge-ts-failed',         label: 'ล้มเหลว' },
  EXPIRED:       { cls: 'badge-ts-expired',        label: 'หมดอายุ' },
  VOID_PREPARED: { cls: 'badge-ts-void-prepared',  label: 'กำลังยกเลิก' },
  VOID:          { cls: 'badge-ts-void',           label: 'ยกเลิกแล้ว' },
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { cls, label } = PS_CFG[status];
  return <span className={`status-badge ${cls}`}><span className="status-dot" />{label}</span>;
}

function TxStatusBadge({ status }: { status: TransactionStatus }) {
  const { cls, label } = TS_CFG[status];
  return <span className={`status-badge ${cls}`}><span className="status-dot" />{label}</span>;
}

/** PAT-2036: override badge ใน column สถานะธุรกรรม */
function TxStatusBadgeWithOverpay({ tx }: { tx: Transaction }) {
  // Overpay: ยอดชำระเกิน รอ Finance ตัดสินใจ
  const isOverpay =
    (tx.overpay_delta ?? 0) > 0 &&
    !tx.overpay_acknowledged &&
    tx.payment_status === 'COMPLETED';

  // CANCELLED + REFUND_PENDING: order ยกเลิกแต่ลูกค้าโอนเงินมาแล้ว รอคืนเงิน
  const isCancelledRefundPending =
    tx.transaction_status === 'CANCELLED' &&
    tx.payment_status === 'REFUND_PENDING';

  if (isOverpay) {
    return (
      <span className="status-badge badge-ts-overpay">
        <span className="status-dot" />ชำระเกิน
      </span>
    );
  }
  if (isCancelledRefundPending) {
    return (
      <span className="status-badge badge-ps-refund-pending">
        <span className="status-dot" />รอคืนเงิน
      </span>
    );
  }
  return <TxStatusBadge status={tx.transaction_status} />;
}

// ── Amount cell ─────────────────────────────────────────────────────────────

function amountClass(tx: Transaction): string {
  if (tx.payment_status === 'COMPLETED' || tx.transaction_status === 'CLOSED' || tx.transaction_status === 'SETTLED') return 'paid';
  return 'pending';
}

// ── Action button logic ─────────────────────────────────────────────────────

interface ActionBtn { label: string; variant: 'brand' | 'view' }

function getActionButtons(tx: Transaction): { primary: ActionBtn; secondary?: ActionBtn } {
  // PAT-2036: Overpay — รอ Finance Manager ตัดสินใจ
  const isOverpay =
    (tx.overpay_delta ?? 0) > 0 &&
    !tx.overpay_acknowledged &&
    tx.payment_status === 'COMPLETED';

  if (isOverpay) {
    return {
      primary:   { label: 'คืนเงิน', variant: 'brand' },
      secondary: { label: 'ดู',      variant: 'view'  },
    };
  }

  // OMS-cancelled + REFUND_PENDING — มีการชำระแล้ว Finance ต้องคืนเงิน (ไม่ต้องระบุเหตุผล)
  const isOmsCancelledNeedsRefund =
    tx.transaction_status === 'CANCELLED' &&
    tx.payment_status === 'REFUND_PENDING' &&
    !!tx.cancellation_reason;

  if (isOmsCancelledNeedsRefund) {
    return {
      primary:   { label: 'คืนเงิน',       variant: 'brand' },
      secondary: { label: 'ดูรายละเอียด', variant: 'view'  },
    };
  }

  // OMS-cancelled + ยังไม่ชำระ — ดูรายละเอียดได้อย่างเดียว
  const isOmsCancelledNoPay =
    tx.transaction_status === 'CANCELLED' &&
    tx.payment_status !== 'REFUND_PENDING' &&
    !!tx.cancellation_reason;

  if (isOmsCancelledNoPay) {
    return { primary: { label: 'ดูรายละเอียด', variant: 'view' } };
  }

  // CANCELLED + REFUND_PENDING (non-OMS) — Finance ต้องดำเนินการคืนเงิน
  const isCancelledRefundPending =
    tx.transaction_status === 'CANCELLED' &&
    tx.payment_status === 'REFUND_PENDING';

  if (isCancelledRefundPending) {
    return { primary: { label: 'ดูรายละเอียด', variant: 'brand' } };
  }

  const isTerminal =
    tx.transaction_status === 'CANCELLED' ||
    tx.transaction_status === 'FAILED'    ||
    tx.transaction_status === 'EXPIRED';

  const isCompleted =
    (tx.transaction_status === 'CLOSED' || tx.transaction_status === 'SETTLED') &&
    tx.payment_status === 'COMPLETED';

  // Terminal / completed states → view only
  if (isTerminal || isCompleted) {
    return { primary: { label: 'ดูรายละเอียด', variant: 'view' } };
  }

  // รอตรวจสอบ
  if (tx.transaction_status === 'PENDING' && tx.payment_status === 'UNDER_REVIEW') {
    return {
      primary:   { label: 'ตรวจสอบ', variant: 'brand' },
      secondary: { label: 'ดู',       variant: 'view'  },
    };
  }

  // รอชำระ (PENDING pay / REJECTED / FAILED) — check partial payment
  if (tx.transaction_status === 'PENDING') {
    const hasPartial = tx.payments?.some(p => p.payment_status === 'COMPLETED') ?? false;
    return {
      primary:   { label: hasPartial ? 'ชำระเพิ่ม' : 'ชำระเงิน', variant: 'brand' },
      secondary: { label: 'ดู', variant: 'view' },
    };
  }

  return { primary: { label: 'ดู', variant: 'view' } };
}

// ── Column headers ──────────────────────────────────────────────────────────

interface Col { key: string; label: string; sortable?: boolean; align?: 'right' | 'center' }

const COLS: Col[] = [
  { key: '_expand',            label: '' },
  { key: 'created_at',         label: 'วันที่และเวลา',        sortable: true },
  { key: 'transaction_no',     label: 'Transaction ID / Order No' },
  { key: 'store_name',         label: 'ร้านค้า' },
  { key: 'payment_channel',    label: 'ช่องทางการชำระเงิน' },
  { key: 'transfer_time',      label: 'เวลาโอน',              sortable: true },
  { key: 'amount',             label: 'ยอดเงิน',              sortable: true, align: 'right' },
  { key: 'slip_count',         label: 'สลิป',                 align: 'center' },
  { key: 'payment_status',     label: 'สถานะการชำระเงิน' },
  { key: 'transaction_status', label: 'สถานะธุรกรรม' },
  { key: '_action',            label: '',                     align: 'center' },
];

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  newRows: Set<string>;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  onSubmitPayment?: (tx: Transaction) => void;
}

// ── Slip thumbnails ─────────────────────────────────────────────────────────

const MAX_VISIBLE_SLIPS = 3;

function SlipThumbs({ slips, onOpen }: { slips: Slip[]; onOpen: (s: Slip) => void }) {
  if (!slips.length) return <span className="cell-placeholder">—</span>;
  const visible = slips.slice(0, MAX_VISIBLE_SLIPS);
  const extra   = slips.length - MAX_VISIBLE_SLIPS;
  return (
    <div className="slip-thumbs">
      {visible.map((slip, i) => (
        <img
          key={slip.slip_id}
          src={slip.image_url}
          alt="สลิป"
          className="slip-thumb"
          style={{ zIndex: visible.length - i }}
          onClick={e => { e.stopPropagation(); onOpen(slip); }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ))}
      {extra > 0 && (
        <div
          className="slip-thumb slip-thumb-more"
          style={{ zIndex: 0 }}
          onClick={e => { e.stopPropagation(); onOpen(slips[MAX_VISIBLE_SLIPS]); }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TransactionTable({ transactions, newRows, sortField, sortDirection, onSort, onSubmitPayment }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeSlip, setActiveSlip] = useState<Slip | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  return (
    <>
    <SlipPreviewModal slip={activeSlip} onClose={() => setActiveSlip(null)} />
    <div className="table-wrap">
      <table className="tx-table">
        <thead>
          <tr>
            {COLS.map(col => (
              <th
                key={col.key}
                className={[
                  col.sortable ? 'sortable' : '',
                  col.sortable && sortField === col.key ? 'sort-active' : '',
                ].filter(Boolean).join(' ')}
                style={{ textAlign: col.align || 'left' }}
                onClick={() => col.sortable && onSort(col.key)}
              >
                {col.label}
                {col.sortable && (
                  <span className="sort-icon">
                    {sortField === col.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => {
            const isNew = newRows.has(tx.transaction_id);
            const isExpanded = expanded.has(tx.transaction_id);
            const created = formatThaiDate(tx.created_at);
            const transfer = tx.transfer_time ? formatThaiDate(tx.transfer_time) : null;
            const amtCls = amountClass(tx);
            const hasPayments = tx.payments && tx.payments.length > 0;
            // รอชำระ = ยังไม่รู้ช่องทาง เว้นแต่แบ่งจ่าย (hasPayments) จะขึ้น "หลายช่องทาง"
            const isPendingNoChannel =
              !hasPayments &&
              tx.transaction_status === 'PENDING' &&
              (tx.payment_status === 'PENDING' ||
               tx.payment_status === 'REJECTED' ||
               tx.payment_status === 'FAILED');

            return (
              <React.Fragment key={tx.transaction_id}>
                <tr className={isNew ? 'row-new' : ''}>
                  {/* Expand */}
                  <td className="cell-expand">
                    {tx.is_expandable ? (
                      <button className="expand-btn" onClick={() => toggleExpand(tx.transaction_id)}>
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    ) : null}
                  </td>

                  {/* Date */}
                  <td className="date-cell">
                    <div className="date-main">{created.date}</div>
                    <div className="date-time">{created.time}</div>
                  </td>

                  {/* TX ID / Order */}
                  <td>
                    <div className="tx-no" title={tx.transaction_no}>
                      {tx.transaction_no.length > 22 ? tx.transaction_no.slice(0, 22) + '…' : tx.transaction_no}
                    </div>
                    <div className="order-no">{tx.order_no}</div>
                  </td>

                  {/* Store */}
                  <td style={{ fontSize: 18, color: 'var(--text-primary)' }}>{tx.store_name}</td>

                  {/* Channel */}
                  <td>
                    {hasPayments ? (
                      <div className="channel-main">หลายช่องทาง</div>
                    ) : isPendingNoChannel ? (
                      <div className="channel-main" style={{ color: 'var(--text-secondary)' }}>ไม่ระบุ</div>
                    ) : (
                      <>
                        <div className="channel-main">{CHANNEL_LABELS[tx.payment_channel]}</div>
                        {tx.bank_name && <div className="channel-sub">{tx.bank_name}</div>}
                      </>
                    )}
                  </td>

                  {/* Transfer time */}
                  <td className="date-cell">
                    {transfer ? (
                      <>
                        <div className="date-main">{transfer.date}</div>
                        <div className="date-time">{transfer.time}</div>
                      </>
                    ) : (
                      <span className="cell-placeholder">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="amount-cell">
                    {hasPayments ? (() => {
                      const paidAmt = tx.payments!.reduce((s, p) => s + p.amount, 0);
                      const remaining = Math.round((tx.amount - paidAmt) * 100) / 100;
                      return (
                        <>
                          <div className={`amount-value ${amtCls}`}>฿{formatAmount(tx.amount)}</div>
                          {remaining > 0 && (
                            <div className="amount-discount">คงเหลือ ฿{formatAmount(remaining)}</div>
                          )}
                        </>
                      );
                    })() : (
                      <>
                        <div className={`amount-value ${amtCls}`}>฿{formatAmount(tx.amount)}</div>
                        {tx.discount_amount && (
                          <div className="amount-discount">ยอดลด ฿{formatAmount(tx.discount_amount)}</div>
                        )}
                      </>
                    )}
                  </td>

                  {/* Slip */}
                  <td className="slip-cell">
                    {(() => {
                      const slips = hasPayments
                        ? tx.payments!.flatMap(p => p.slips ?? [])
                        : (tx.slips ?? []);
                      return <SlipThumbs slips={slips} onOpen={setActiveSlip} />;
                    })()}
                  </td>

                  {/* Payment status */}
                  <td><PaymentStatusBadge status={tx.payment_status} /></td>

                  {/* Transaction status — PAT-2036: แสดง "ชำระเกิน" เมื่อมี overpay */}
                  <td><TxStatusBadgeWithOverpay tx={tx} /></td>

                  {/* Action */}
                  <td className="action-cell">
                    {(() => {
                      const { primary, secondary } = getActionButtons(tx);
                      const detailHref = `/transactions/${tx.transaction_no}`;
                      // Buttons that navigate to detail page
                      const isLink = (label: string) =>
                        label === 'ดู' || label === 'ดูรายละเอียด' || label === 'ตรวจสอบ' || label === 'คืนเงิน';
                      const isPayAction = (label: string) =>
                        label === 'ชำระเงิน' || label === 'ชำระเพิ่ม';
                      const renderBtn = (btn: ActionBtn) => {
                        if (isLink(btn.label)) {
                          return <Link href={detailHref} className={`action-btn action-btn--${btn.variant}`}>{btn.label}</Link>;
                        }
                        if (isPayAction(btn.label)) {
                          return (
                            <button
                              className={`action-btn action-btn--${btn.variant}`}
                              onClick={() => onSubmitPayment?.(tx)}
                            >
                              {btn.label}
                            </button>
                          );
                        }
                        return <button className={`action-btn action-btn--${btn.variant}`}>{btn.label}</button>;
                      };
                      return (
                        <div className="action-btns">
                          {renderBtn(primary)}
                          {secondary && renderBtn(secondary)}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
                {isExpanded && tx.payments?.map(p => {
                  const pTransfer = p.transfer_time ? formatThaiDate(p.transfer_time) : null;
                  return (
                    <tr key={p.payment_id} className="expand-sub-row">
                      <td className="cell-expand" />
                      <td />
                      <td />
                      <td style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: 24 }}>รายการที่ {p.seq}</td>
                      <td>
                        <div className="channel-main">{CHANNEL_LABELS[p.payment_channel]}</div>
                        {p.bank_name && <div className="channel-sub">{p.bank_name}</div>}
                      </td>
                      <td className="date-cell">
                        {pTransfer ? (<><div className="date-main">{pTransfer.date}</div><div className="date-time">{pTransfer.time}</div></>) : <span className="cell-placeholder">—</span>}
                      </td>
                      <td className="amount-cell">
                        <div className="amount-value paid">฿{formatAmount(p.amount)}</div>
                      </td>
                      <td className="slip-cell">
                        <SlipThumbs slips={p.slips ?? []} onOpen={setActiveSlip} />
                      </td>
                      <td><PaymentStatusBadge status={p.payment_status} /></td>
                      {/* Sub-row tx status — blank (no tx-level status per payment) */}
                      <td />
                      {/* Sub-row action — view slip/detail */}
                      <td className="action-cell">
                        <div className="action-btns">
                          <Link href={`/transactions/${tx.transaction_no}`} className="action-btn action-btn--view">ดู</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
