'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

type VoidReason =
  | 'cashier_entry_error'
  | 'order_cancelled_by_customer'
  | 'duplicate_payment'
  | 'customer_refused_goods'
  | 'wrong_amount'
  | 'other';

const VOID_REASONS: { value: VoidReason; label: string }[] = [
  { value: 'cashier_entry_error',         label: 'บันทึกการชำระผิดพลาด/ไม่มีการรับเงินจริง' },
  { value: 'order_cancelled_by_customer', label: 'ลูกค้าขอยกเลิกออเดอร์' },
  { value: 'duplicate_payment',           label: 'ชำระซ้ำโดยไม่ตั้งใจ' },
  { value: 'customer_refused_goods',      label: 'ลูกค้าปฏิเสธรับสินค้า/ไม่ต้องการรับสินค้า' },
  { value: 'wrong_amount',                label: 'ยอดเงินไม่ถูกต้อง/ข้อมูลผิด' },
  { value: 'other',                       label: 'อื่นๆ' },
];

function fmt(n: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

async function mockInitiateVoid(transactionId: string, reason: VoidReason): Promise<void> {
  await new Promise(r => setTimeout(r, 1000));
  console.info('[mock] POST /transactions/%s/void { reason: %s }', transactionId, reason);
}

export interface VoidDialogProps {
  open: boolean;
  transactionId: string;
  cashAmount: number;
  preFilledReason?: string;  // OMS-provided label OR reason key — skips step 1
  orderNo?: string;          // PAT-2426: show order-stays-active warning instead of cash confirm
  onSuccess: (reason: string) => void;
  onClose: () => void;
}

export default function VoidDialog({
  open,
  transactionId,
  cashAmount,
  preFilledReason,
  orderNo,
  onSuccess,
  onClose,
}: VoidDialogProps) {
  const [mounted, setMounted]             = useState(false);
  const [step, setStep]                   = useState<1 | 2>(1);
  const [reason, setReason]               = useState<VoidReason | ''>('');
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setStep(preFilledReason ? 2 : 1);
      setReason('');
      setCashConfirmed(false);
      setSubmitting(false);
    }
  }, [open, preFilledReason]);

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

  // Accepts either a reason key (e.g. 'cashier_entry_error') or a pre-translated label
  const selectedReasonLabel = preFilledReason
    ? (VOID_REASONS.find(r => r.value === preFilledReason)?.label ?? preFilledReason)
    : VOID_REASONS.find(r => r.value === reason)?.label ?? '';

  async function handleConfirm() {
    if (submitting) return;
    if (step === 1) {
      if (!reason) return;
      setStep(2);
      setCashConfirmed(false);
      return;
    }
    if (!cashConfirmed) return;
    setSubmitting(true);
    try {
      const reasonToSend = preFilledReason ?? (reason as VoidReason);
      await mockInitiateVoid(transactionId, reasonToSend as VoidReason);
      onSuccess(reasonToSend as string);
    } catch {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  const canProceed = step === 1
    ? !!reason && !submitting
    : orderNo
      ? !submitting            // PAT-2426: no checkbox required
      : cashConfirmed && !submitting;

  const content = (
    <>
      <div className="dialog-backdrop" onClick={handleClose} />
      <div
        className="fmd-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="void-dialog-title"
      >
        {/* ── Header ── */}
        <div className="fmd-header">
          <div id="void-dialog-title" className="fmd-title">
            {step === 1 || orderNo
              ? <>ยกเลิกชำระ <span className="fmd-id--orange">{transactionId}</span></>
              : <>คืนเงินธุรกรรม <span className="fmd-id--blue">{transactionId}</span></>
            }
          </div>
        </div>

        {/* ── Content ── */}
        <div className="fmd-content">
          {step === 1 && (
            <div className="fmd-field-group">
              <div className="fmd-section-label">
                เหตุผลในการขอยกเลิก<span className="fmd-required">*</span>
              </div>
              <div className="fmd-reason-list">
                {VOID_REASONS.map(r => (
                  <label key={r.value} className="fmd-reason-item">
                    <input
                      type="radio"
                      name="void-reason"
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
          )}

          {step === 2 && (
            <>
              {/* Summary box */}
              <div className="fmd-summary-box fmd-summary-box--centered">
                <div className="fmd-summary-amount-label">จำนวนยอดชำระ</div>
                <div className="fmd-summary-amount-value">฿{fmt(cashAmount)}</div>
                {selectedReasonLabel && (
                  <>
                    <div className="fmd-summary-divider" />
                    <div className="fmd-summary-row">
                      <span className="fmd-summary-row-label">เหตุผลการขอยกเลิก</span>
                      <span className="fmd-summary-row-value">{selectedReasonLabel}</span>
                    </div>
                  </>
                )}
              </div>

              {/* PAT-2426: order stays active warning OR OMS: cash confirm checkbox */}
              {orderNo ? (
                <div className="fmd-order-warning">
                  <span className="fmd-order-warning-icon">⚠️</span>
                  <span className="fmd-order-warning-text">
                    Order <strong>{orderNo}</strong> จะยังคงอยู่ สามารถบันทึกรับเงินใหม่ได้อีกครั้ง
                  </span>
                </div>
              ) : (
                <label className="fmd-cash-confirm-panel">
                  <span className="fmd-cash-confirm-text">
                    ยืนยันว่าได้คืนเงินสด{' '}
                    <strong className="fmd-cash-confirm-amount">฿{fmt(cashAmount)}</strong>{' '}
                    ให้ลูกค้า
                  </span>
                  <input
                    type="checkbox"
                    className="fmd-cash-confirm-checkbox"
                    checked={cashConfirmed}
                    onChange={e => setCashConfirmed(e.target.checked)}
                    disabled={submitting}
                  />
                </label>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="fmd-footer fmd-footer--form">
          <button
            type="button"
            className="fmd-btn fmd-btn--cancel"
            onClick={step === 2 && !preFilledReason ? () => { setStep(1); setCashConfirmed(false); } : handleClose}
            disabled={submitting}
          >
            {step === 2 && !preFilledReason ? 'ย้อนกลับ' : 'ยกเลิก'}
          </button>
          <button
            type="button"
            className={`fmd-btn ${step === 1 || orderNo ? 'fmd-btn--orange' : 'fmd-btn--blue'}`}
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
