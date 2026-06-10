'use client';

/**
 * PAT-2036 — Tip Confirmation Dialog
 *
 * แสดงเมื่อ Finance Manager กดปุ่ม "ถือเป็น Tip" ใน OverpayBanner
 * ไม่มีฟอร์ม — เพียง confirm dialog เท่านั้น
 * Submit → mock POST /transactions/:id/acknowledge-overpay
 *       → onSuccess() → parent เปลี่ยน decision → 'acknowledged'
 */

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ── Mock API ─────────────────────────────────────────────────────────────────

async function mockAcknowledgeOverpay(transactionId: string): Promise<{ acknowledged: boolean }> {
  await new Promise(r => setTimeout(r, 600));
  console.info('[mock] POST /transactions/%s/acknowledge-overpay → 200', transactionId);
  return { acknowledged: true };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TipConfirmDialogProps {
  open: boolean;
  transactionId: string;
  overpayDelta: number;
  onSuccess: () => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TipConfirmDialog({
  open,
  transactionId,
  overpayDelta,
  onSuccess,
  onClose,
}: TipConfirmDialogProps) {
  const [mounted, setMounted]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset on open
  useEffect(() => {
    if (open) setSubmitting(false);
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
    setSubmitting(true);
    try {
      await mockAcknowledgeOverpay(transactionId);
      onSuccess();
    } catch {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div className="dialog-backdrop" onClick={handleClose} />

      {/* Dialog */}
      <div
        className="dialog-panel dialog-panel--sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tip-dialog-title"
        aria-describedby="tip-dialog-desc"
      >
        {/* Icon */}
        <div className="dialog-icon-wrap">
          <div className="dialog-icon dialog-icon--tip">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 6v4m0 4h.01" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="dialog-header dialog-header--centered">
          <div id="tip-dialog-title" className="dialog-title">ยืนยันว่าเป็น Tip</div>
        </div>

        {/* Body */}
        <div id="tip-dialog-desc" className="dialog-body dialog-body--centered">
          <p className="tip-dialog-body-text">
            ยืนยันว่าไม่ต้องคืนเงิน ยอดเกิน{' '}
            <span className="tip-dialog-amount">฿{formatAmount(overpayDelta)}</span>{' '}
            ถือเป็น Tip?
          </p>
          <p className="tip-dialog-note">
            การดำเนินการนี้ไม่สามารถเลิกทำได้
          </p>
        </div>

        {/* Footer */}
        <div className="dialog-footer dialog-footer--centered">
          <button
            type="button"
            className="dialog-btn dialog-btn--cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className={`dialog-btn dialog-btn--warning${submitting ? ' dialog-btn--loading' : ''}`}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="dialog-spinner" aria-hidden="true" />
                กำลังบันทึก…
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
