'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

type VoidReason =
  | 'order_cancelled_by_customer'
  | 'duplicate_payment'
  | 'customer_refused_goods'
  | 'wrong_amount'
  | 'other';

const VOID_REASONS_BT: { value: VoidReason; label: string }[] = [
  { value: 'order_cancelled_by_customer', label: 'ลูกค้าขอยกเลิกออเดอร์' },
  { value: 'duplicate_payment',           label: 'ชำระซ้ำโดยไม่ตั้งใจ' },
  { value: 'customer_refused_goods',      label: 'ลูกค้าปฏิเสธรับสินค้า/ไม่ต้องการรับสินค้า' },
  { value: 'wrong_amount',               label: 'ยอดเงินไม่ถูกต้อง/ข้อมูลผิด' },
  { value: 'other',                       label: 'อื่นๆ' },
];

function fmt(n: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

async function mockInitiateVoidBT(transactionId: string, reason: VoidReason): Promise<void> {
  await new Promise(r => setTimeout(r, 1000));
  console.info('[mock] POST /transactions/%s/void-bt { reason: %s }', transactionId, reason);
}

export interface VoidBTDialogProps {
  open: boolean;
  transactionId: string;
  btAmount: number;
  onSuccess: (reason: string) => void;
  onClose: () => void;
}

export default function VoidBTDialog({
  open,
  transactionId,
  btAmount,
  onSuccess,
  onClose,
}: VoidBTDialogProps) {
  const [mounted, setMounted]     = useState(false);
  const [reason, setReason]       = useState<VoidReason | ''>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  async function handleConfirm() {
    if (submitting || !reason) return;
    setSubmitting(true);
    try {
      await mockInitiateVoidBT(transactionId, reason as VoidReason);
      onSuccess(reason);
    } catch {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  const canProceed = !!reason && !submitting;

  const content = (
    <>
      <div className="dialog-backdrop" onClick={handleClose} />
      <div
        className="fmd-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="void-bt-dialog-title"
      >
        {/* ── Header ── */}
        <div className="fmd-header">
          <div id="void-bt-dialog-title" className="fmd-title">
            ยกเลิกการชำระ <span className="fmd-id--orange">{transactionId}</span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="fmd-content">
          {/* Summary */}
          <div className="fmd-summary-box fmd-summary-box--centered">
            <div className="fmd-summary-amount-label">จำนวนยอดชำระ</div>
            <div className="fmd-summary-amount-value">฿{fmt(btAmount)}</div>
            <div className="fmd-summary-divider" />
            <div className="fmd-summary-row">
              <span className="fmd-summary-row-label">วิธีชำระ</span>
              <span className="fmd-summary-row-value fmd-badge-bt">โอนธนาคาร</span>
            </div>
          </div>

          {/* Reason */}
          <div className="fmd-field-group">
            <div className="fmd-section-label">
              เหตุผลในการขอยกเลิก<span className="fmd-required">*</span>
            </div>
            <div className="fmd-reason-list">
              {VOID_REASONS_BT.map(r => (
                <label key={r.value} className="fmd-reason-item">
                  <input
                    type="radio"
                    name="void-bt-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    disabled={submitting}
                    className="fmd-reason-radio"
                  />
                  <span className="fmd-reason-text">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Finance Task info */}
          <div className="fmd-info-box">
            <svg className="fmd-info-box-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="fmd-info-box-text">
              ระบบจะสร้างงานคืนเงินให้ <strong>Finance Manager</strong> ดำเนินการโอนคืนให้ลูกค้าโดยอัตโนมัติ
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="fmd-footer fmd-footer--form">
          <button
            type="button"
            className="fmd-btn fmd-btn--cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="fmd-btn fmd-btn--orange"
            onClick={handleConfirm}
            disabled={!canProceed}
          >
            {submitting ? (
              <>
                <span className="dialog-spinner" aria-hidden="true" />
                กำลังดำเนินการ…
              </>
            ) : (
              'ยืนยัน'
            )}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
