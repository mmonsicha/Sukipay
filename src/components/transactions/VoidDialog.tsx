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

const VOID_REASONS: { value: VoidReason; label: string; cashConfirm: boolean }[] = [
  { value: 'cashier_entry_error',        label: 'บันทึกการชำระผิดพลาด / ไม่มีการรับเงินจริง', cashConfirm: false },
  { value: 'order_cancelled_by_customer',label: 'ลูกค้าขอยกเลิกออร์เดอร์',                   cashConfirm: true  },
  { value: 'duplicate_payment',          label: 'ชำระซ้ำโดยไม่ตั้งใจ',                        cashConfirm: true  },
  { value: 'customer_refused_goods',     label: 'ลูกค้าปฏิเสธรับสินค้า / ไม่ต้องการรับสินค้า', cashConfirm: true  },
  { value: 'wrong_amount',               label: 'ยอดเงินไม่ถูกต้อง/ข้อมูลผิด',                 cashConfirm: true  },
  { value: 'other',                      label: 'อื่นๆ',                                        cashConfirm: true  },
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
  onSuccess: (reason: VoidReason) => void;
  onClose: () => void;
}

export default function VoidDialog({ open, transactionId, cashAmount, onSuccess, onClose }: VoidDialogProps) {
  const [mounted, setMounted]           = useState(false);
  const [reason, setReason]             = useState<VoidReason | ''>('');
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setReason('');
      setCashConfirmed(false);
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

  const selectedReason  = VOID_REASONS.find(r => r.value === reason);
  const needsCashConfirm = selectedReason?.cashConfirm ?? false;
  const canSubmit = !!reason && (!needsCashConfirm || cashConfirmed) && !submitting;

  async function handleConfirm() {
    if (!reason || !canSubmit) return;
    setSubmitting(true);
    try {
      await mockInitiateVoid(transactionId, reason as VoidReason);
      onSuccess(reason as VoidReason);
    } catch {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  const content = (
    <>
      <div className="dialog-backdrop" onClick={handleClose} />

      <div
        className="dialog-panel void-dialog-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="void-dialog-title"
      >
        {/* ── Header ── */}
        <div className="void-dialog-header">
          <div id="void-dialog-title" className="void-dialog-title">
            ยกเลิกการชำระ <span className="void-dialog-txn-id">{transactionId}</span>
          </div>
        </div>

        {/* ── Amount section ── */}
        <div className="void-dialog-amount-section">
          <div className="void-dialog-amount-label">จำนวนยอดคืน</div>
          <div className="void-dialog-amount-value">฿{fmt(cashAmount)}</div>
        </div>

        <div className="void-dialog-divider" />

        {/* ── Body ── */}
        <div className="void-dialog-body">
          <div className="void-dialog-reason-label">
            เหตุผลในการยกเลิก<span className="dialog-required">*</span>
          </div>

          <div className="void-reason-list">
            {VOID_REASONS.map(r => (
              <label key={r.value} className="void-reason-item">
                <input
                  type="radio"
                  name="void-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => {
                    setReason(r.value);
                    setCashConfirmed(false);
                  }}
                  disabled={submitting}
                  className="void-reason-radio"
                />
                <span className="void-reason-text">{r.label}</span>
              </label>
            ))}
          </div>

          {/* Cash confirmation checkbox — แสดงเฉพาะ reason ที่ต้องคืนเงินจริง */}
          {needsCashConfirm && (
            <label className="void-cash-confirm-row">
              <input
                type="checkbox"
                className="void-cash-confirm-checkbox"
                checked={cashConfirmed}
                onChange={e => setCashConfirmed(e.target.checked)}
                disabled={submitting}
              />
              <span className="void-cash-confirm-text">
                ยืนยันว่าได้คืนเงินสด{' '}
                <strong className="void-cash-confirm-amount">฿{fmt(cashAmount)}</strong>{' '}
                ให้ลูกค้าแล้ว
              </span>
            </label>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="void-dialog-footer">
          <button
            type="button"
            className="void-footer-btn void-footer-btn--cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="void-footer-btn void-footer-btn--confirm"
            onClick={handleConfirm}
            disabled={!canSubmit}
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
