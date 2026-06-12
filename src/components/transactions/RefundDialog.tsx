'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { RefundRecord, PaymentChannel } from '@/lib/types';

// ── Bank list ─────────────────────────────────────────────────────────────────

const BANK_OPTIONS = [
  { value: '002', labelTH: 'กรุงเทพ (BBL)' },
  { value: '004', labelTH: 'กสิกรไทย (KBANK)' },
  { value: '006', labelTH: 'กรุงไทย (KTB)' },
  { value: '011', labelTH: 'ทหารไทยธนชาต (TTB)' },
  { value: '014', labelTH: 'ไทยพาณิชย์ (SCB)' },
  { value: '025', labelTH: 'กรุงศรี (BAY)' },
  { value: '069', labelTH: 'เกียรตินาคินภัทร (KKP)' },
  { value: '073', labelTH: 'แลนด์แอนด์เฮาส์ (LHFG)' },
] as const;

// ── Refund reasons ────────────────────────────────────────────────────────────

type RefundReasonCode =
  | 'overpay'
  | 'cashier_error'
  | 'product_issue'
  | 'out_of_stock'
  | 'order_cancel'
  | 'other';

const REFUND_REASONS: { value: RefundReasonCode; label: string; requiresNote: boolean }[] = [
  { value: 'cashier_error',  label: 'บันทึกการชำระผิดพลาด/ไม่มีการรับเงินจริง', requiresNote: false },
  { value: 'order_cancel',   label: 'ลูกค้าขอยกเลิกออเดอร์',                    requiresNote: false },
  { value: 'overpay',        label: 'ชำระซ้ำโดยไม่ตั้งใจ',                       requiresNote: false },
  { value: 'product_issue',  label: 'ลูกค้าปฏิเสธรับสินค้า/ไม่ต้องการรับสินค้า', requiresNote: false },
  { value: 'out_of_stock',   label: 'ยอดเงินไม่ถูกต้อง/ข้อมูลผิด',               requiresNote: false },
  { value: 'other',          label: 'อื่นๆ',                                      requiresNote: true  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function bankLabel(code: string): string {
  return BANK_OPTIONS.find(b => b.value === code)?.labelTH ?? code;
}

function maskAccount(acct: string): string {
  if (acct.length <= 4) return acct;
  return 'x'.repeat(acct.length - 4) + acct.slice(-4);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Mock API ──────────────────────────────────────────────────────────────────

async function mockRequestRefund(params: {
  transactionId: string;
  paymentId: string;
  amount: number;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  note: string;
  reason: RefundReasonCode;
}): Promise<{ finance_task_id: string }> {
  await new Promise(r => setTimeout(r, 1600));
  console.info('[mock] POST /transactions/%s/refund/request %o', params.transactionId, params);
  return { finance_task_id: `ft-${uid()}` };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EligiblePayment {
  payment_id: string;
  seq: number;
  amount: number;
  payment_channel?: PaymentChannel;
  bank_name?: string;
  account_number?: string;
  refunds?: RefundRecord[];
}

export interface RefundSubmitResult {
  paymentId: string;
  record: RefundRecord;
}

interface RefundDialogProps {
  open: boolean;
  transactionId: string;
  overpayDelta: number;
  alreadyRefunded: number;
  eligiblePayments: EligiblePayment[];
  preSelectedPaymentId?: string;
  cancelMode?: boolean;        // cancel-order flow
  preFilledReason?: string;    // OMS reason — hides reason selector
  onSuccess: (result: RefundSubmitResult) => void;
  onClose: () => void;
  onClickTip?: () => void;     // overpay only: switch to tip flow
}

type DialogPhase = 'form' | 'submitting' | 'success';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RefundDialog({
  open,
  transactionId,
  overpayDelta,
  alreadyRefunded,
  eligiblePayments,
  preSelectedPaymentId,
  cancelMode = false,
  preFilledReason,
  onSuccess,
  onClose,
  onClickTip,
}: RefundDialogProps) {
  const [mounted, setMounted]           = useState(false);
  const [phase, setPhase]               = useState<DialogPhase>('form');
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [reason, setReason]             = useState<RefundReasonCode | ''>('');
  const [amount, setAmount]             = useState('');
  const [accountName, setAccountName]   = useState('');
  const [bankCode, setBankCode]         = useState('');
  const [bankAccount, setBankAccount]   = useState('');
  const [note, setNote]                 = useState('');
  const [proofAttached, setProofAttached] = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [successResult, setSuccessResult] = useState<RefundSubmitResult | null>(null);

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isManualMode     = cancelMode || overpayDelta <= 0;
  const remainingToRefund = overpayDelta - alreadyRefunded;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setPhase('form');
      const initPayId = preSelectedPaymentId ?? eligiblePayments[0]?.payment_id ?? '';
      setSelectedPaymentId(initPayId);
      setReason(preFilledReason ? (preFilledReason as RefundReasonCode) : isManualMode ? '' : 'overpay');

      if (isManualMode) {
        const selPay  = eligiblePayments.find(p => p.payment_id === initPayId);
        const alrdyOn = (selPay?.refunds ?? []).reduce((s, r) => s + r.amount, 0);
        const maxAmt  = (selPay?.amount ?? 0) - alrdyOn;
        setAmount(maxAmt > 0 ? String(maxAmt) : '');
      } else {
        setAmount(String(remainingToRefund));
      }

      setAccountName('');
      setBankCode('');
      setBankAccount('');
      setNote('');
      setProofAttached(false);
      setErrors({});
      setSuccessResult(null);
    }
    return () => { if (autoCloseRef.current) clearTimeout(autoCloseRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const p = eligiblePayments.find(e => e.payment_id === selectedPaymentId);
    if (p?.account_number) setBankAccount(p.account_number);
  }, [selectedPaymentId, eligiblePayments]);

  const handleClose = useCallback(() => {
    if (phase === 'submitting') return;
    onClose();
  }, [phase, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  const selectedPayment    = eligiblePayments.find(p => p.payment_id === selectedPaymentId);
  const alreadyOnSelected  = (selectedPayment?.refunds ?? []).reduce((s, r) => s + r.amount, 0);
  const maxAmount          = isManualMode
    ? (selectedPayment?.amount ?? 0) - alreadyOnSelected
    : remainingToRefund;
  const selectedReasonDef  = REFUND_REASONS.find(r => r.value === reason);
  const numAmount          = parseFloat(amount.replace(/,/g, ''));

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedPaymentId) next.payment = 'กรุณาเลือกช่องทางที่จะโอนคืน';
    if (isManualMode && !preFilledReason && !reason) next.reason = 'กรุณาเลือกเหตุผลในการคืนเงิน';
    if (selectedReasonDef?.requiresNote && !note.trim()) next.note = 'กรุณาระบุรายละเอียดสำหรับเหตุผลนี้';
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      next.amount = 'กรุณาระบุยอดที่ต้องการคืน';
    } else if (numAmount > maxAmount + 0.001) {
      next.amount = `ยอดสูงสุดที่คืนได้คือ ฿${fmt(maxAmount)}`;
    }
    if (!accountName.trim()) next.accountName = 'กรุณาระบุชื่อบัญชีปลายทาง';
    if (!bankCode)           next.bankCode    = 'กรุณาเลือกธนาคาร';
    const digits = bankAccount.replace(/-/g, '');
    if (!digits || !/^\d{10,15}$/.test(digits)) next.bankAccount = 'เลขบัญชีไม่ถูกต้อง (10–15 หลัก)';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPhase('submitting');
    const numAmt = parseFloat(amount.replace(/,/g, ''));
    const bName  = bankLabel(bankCode);

    try {
      const res = await mockRequestRefund({
        transactionId,
        paymentId: selectedPaymentId,
        amount: numAmt,
        bankCode,
        bankName: bName,
        accountNumber: bankAccount.replace(/-/g, ''),
        accountName: accountName.trim(),
        note: note.trim(),
        reason: reason as RefundReasonCode,
      });

      const record: RefundRecord = {
        refund_id:      `refund-${uid()}`,
        payment_id:     selectedPaymentId,
        amount:         numAmt,
        bank_code:      bankCode,
        bank_name:      bName,
        account_number: bankAccount.replace(/-/g, ''),
        account_name:   accountName.trim(),
        note:           note.trim() || undefined,
        proof_url:      proofAttached ? '/mock-refund-slip.jpg' : undefined,
        requested_at:   new Date().toISOString(),
        requested_by:   'วิไล จันทร์',
        completed_at:   new Date(Date.now() + 900_000).toISOString(),
        status:         'COMPLETED',
        finance_task_id: res.finance_task_id,
      };

      const result: RefundSubmitResult = { paymentId: selectedPaymentId, record };
      setSuccessResult(result);
      setPhase('success');
      autoCloseRef.current = setTimeout(() => onSuccess(result), 1800);
    } catch {
      setErrors({ submit: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
      setPhase('form');
    }
  }

  if (!mounted || !open) return null;

  const fieldsComplete = !!(
    selectedPaymentId &&
    (reason || !isManualMode || !!preFilledReason) &&
    amount && !isNaN(numAmount) && numAmount > 0 &&
    accountName &&
    bankCode &&
    bankAccount &&
    (!selectedReasonDef?.requiresNote || note.trim())
  );

  // ── Success screen ──────────────────────────────────────────────────────────
  if (phase === 'success' && successResult) {
    return createPortal(
      <>
        <div className="dialog-backdrop" />
        <div className="fmd-panel" role="dialog" aria-modal="true">
          <div className="fmd-success-state">
            <div className="fmd-success-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="fmd-success-title">ส่งคำขอคืนเงินสำเร็จ</div>
            <div className="fmd-success-detail">
              <span className="fmd-success-amount">฿{fmt(successResult.record.amount)}</span>
              {' → '}{successResult.record.bank_name}
            </div>
            <div className="fmd-success-account">
              {maskAccount(successResult.record.account_number)} · {successResult.record.account_name}
            </div>
            <div className="fmd-success-closing">กำลังปิดอัตโนมัติ…</div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  // ── Summary box content ─────────────────────────────────────────────────────
  const summaryBox = !cancelMode ? (
    // Overpay mode: show ยอดที่ชำระ + ยอดเกิน rows
    <div className="fmd-summary-box">
      <div className="fmd-summary-rows">
        <div className="fmd-summary-row">
          <span className="fmd-summary-row-label">ยอดที่ชำระ</span>
          <span className="fmd-summary-row-value">฿{fmt(selectedPayment?.amount ?? 0)}</span>
        </div>
        <div className="fmd-summary-row">
          <span className="fmd-summary-row-label">ยอดเกิน</span>
          <span className="fmd-summary-row-value fmd-summary-row-value--blue">฿{fmt(remainingToRefund)}</span>
        </div>
      </div>
    </div>
  ) : (
    // Cancel mode: show single large amount
    <div className="fmd-summary-box fmd-summary-box--centered">
      <div className="fmd-summary-amount-label">จำนวนยอดชำระ</div>
      <div className="fmd-summary-amount-value">฿{fmt(selectedPayment?.amount ?? maxAmount)}</div>
    </div>
  );

  const content = (
    <>
      <div className="dialog-backdrop" onClick={handleClose} />
      <div
        className="fmd-panel fmd-panel--refund"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-dialog-title"
      >
        {/* ── Header ── */}
        <div className="fmd-header">
          <div id="refund-dialog-title" className="fmd-title">
            {cancelMode
              ? <>ยกเลิกชำระ <span className="fmd-id--blue">{transactionId}</span></>
              : <>คืนเงินธุรกรรม <span className="fmd-id--blue">{transactionId}</span></>
            }
          </div>
        </div>

        {/* ── Scrollable body + footer ── */}
        <form className="fmd-refund-form" onSubmit={handleSubmit} noValidate>
        <div className="fmd-content fmd-content--scroll">

          {/* Summary box */}
          {summaryBox}

          {/* ── Reason selector (cancelMode, no preFilledReason) ── */}
          {isManualMode && !preFilledReason && (
            <div className="fmd-field-group">
              <div className="fmd-section-label">
                เหตุผลในการคืนเงิน<span className="fmd-required">*</span>
              </div>
              <div className="fmd-reason-list">
                {REFUND_REASONS.filter(r => r.value !== 'overpay').map(r => (
                  <label key={r.value} className="fmd-reason-item">
                    <input
                      type="radio"
                      name="refund-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => {
                        setReason(r.value);
                        setErrors(prev => ({ ...prev, reason: '', note: '' }));
                      }}
                      disabled={phase === 'submitting'}
                      className="fmd-reason-radio"
                    />
                    <span className="fmd-reason-text">{r.label}</span>
                  </label>
                ))}
              </div>
              {errors.reason && <div className="fmd-field-error">{errors.reason}</div>}
            </div>
          )}

          {/* ── Prefilled reason (OMS) ── */}
          {isManualMode && preFilledReason && (
            <div className="fmd-field-group">
              <div className="fmd-section-label">เหตุผลในการยกเลิก</div>
              <div className="refund-prefilled-reason">
                {REFUND_REASONS.find(r => r.value === preFilledReason)?.label ?? preFilledReason}
              </div>
            </div>
          )}

          {/* ── Amount field ── */}
          <div className="fmd-field-group">
            <label htmlFor="refund-amount" className="fmd-section-label">
              ยอดคืน<span className="fmd-required">*</span>
            </label>
            <input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={maxAmount}
              className={`fmd-input${errors.amount ? ' fmd-input--error' : ''}`}
              placeholder="ระบุยอดคืน"
              value={amount}
              onChange={e => { setAmount(e.target.value); setErrors(prev => ({ ...prev, amount: '' })); }}
              disabled={phase === 'submitting'}
            />
            {/* Quick-fill buttons */}
            <div className="fmd-quick-fill-row">
              {!cancelMode && overpayDelta > 0 && (
                <button
                  type="button"
                  className="fmd-quick-fill-btn"
                  onClick={() => setAmount(String(remainingToRefund))}
                  disabled={phase === 'submitting'}
                >
                  ยอดเกิน ฿{fmt(remainingToRefund)}
                </button>
              )}
              <button
                type="button"
                className="fmd-quick-fill-btn"
                onClick={() => setAmount(String(maxAmount))}
                disabled={phase === 'submitting'}
              >
                เต็มจำนวน ฿{fmt(maxAmount)}
              </button>
            </div>
            {errors.amount && <div className="fmd-field-error">{errors.amount}</div>}
          </div>

          {/* ── Channel selector (maps to eligible payment) ── */}
          {eligiblePayments.length > 1 && (
            <div className="fmd-field-group">
              <label htmlFor="refund-channel" className="fmd-section-label">
                ช่องทางชำระที่ต้องการคืนเงิน<span className="fmd-required">*</span>
              </label>
              <select
                id="refund-channel"
                className={`fmd-select${errors.payment ? ' fmd-input--error' : ''}`}
                value={selectedPaymentId}
                onChange={e => {
                  setSelectedPaymentId(e.target.value);
                  setErrors(prev => ({ ...prev, payment: '' }));
                  const p = eligiblePayments.find(ep => ep.payment_id === e.target.value);
                  if (isManualMode && p) {
                    const alrdyOn = (p.refunds ?? []).reduce((s, r) => s + r.amount, 0);
                    const newMax  = p.amount - alrdyOn;
                    setAmount(newMax > 0 ? String(newMax) : '');
                  }
                }}
                disabled={phase === 'submitting'}
              >
                <option value="">เลือกช่องทาง</option>
                {eligiblePayments.map(p => (
                  <option key={p.payment_id} value={p.payment_id}>
                    รายการที่ {p.seq} — {p.payment_channel === 'CASH' ? 'เงินสด' : 'โอนผ่านธนาคาร'} ฿{fmt(p.amount)}
                  </option>
                ))}
              </select>
              {errors.payment && <div className="fmd-field-error">{errors.payment}</div>}
            </div>
          )}

          {/* ── Bank ── */}
          <div className="fmd-field-group">
            <label htmlFor="refund-bank" className="fmd-section-label">
              ธนาคาร<span className="fmd-required">*</span>
            </label>
            <select
              id="refund-bank"
              className={`fmd-select${errors.bankCode ? ' fmd-input--error' : ''}`}
              value={bankCode}
              onChange={e => { setBankCode(e.target.value); setErrors(prev => ({ ...prev, bankCode: '' })); }}
              disabled={phase === 'submitting'}
            >
              <option value="">เลือกธนาคาร</option>
              {BANK_OPTIONS.map(b => (
                <option key={b.value} value={b.value}>{b.labelTH}</option>
              ))}
            </select>
            {errors.bankCode && <div className="fmd-field-error">{errors.bankCode}</div>}
          </div>

          {/* ── Account number ── */}
          <div className="fmd-field-group">
            <label htmlFor="refund-acct" className="fmd-section-label">
              เลขที่บัญชี<span className="fmd-required">*</span>
            </label>
            <input
              id="refund-acct"
              type="text"
              inputMode="numeric"
              className={`fmd-input${errors.bankAccount ? ' fmd-input--error' : ''}`}
              placeholder="ระบุเลขที่บัญชี"
              value={bankAccount}
              onChange={e => { setBankAccount(e.target.value); setErrors(prev => ({ ...prev, bankAccount: '' })); }}
              disabled={phase === 'submitting'}
              maxLength={20}
            />
            {errors.bankAccount && <div className="fmd-field-error">{errors.bankAccount}</div>}
          </div>

          {/* ── Account name ── */}
          <div className="fmd-field-group">
            <label htmlFor="refund-name" className="fmd-section-label">
              ชื่อบัญชี<span className="fmd-required">*</span>
            </label>
            <input
              id="refund-name"
              type="text"
              className={`fmd-input${errors.accountName ? ' fmd-input--error' : ''}`}
              placeholder="ระบุชื่อบัญชี"
              value={accountName}
              onChange={e => { setAccountName(e.target.value); setErrors(prev => ({ ...prev, accountName: '' })); }}
              disabled={phase === 'submitting'}
            />
            {errors.accountName && <div className="fmd-field-error">{errors.accountName}</div>}
          </div>

          {/* ── Note (overpay mode or required reason) ── */}
          {(!cancelMode || selectedReasonDef?.requiresNote) && (
            <div className="fmd-field-group">
              <label htmlFor="refund-note" className="fmd-section-label">
                เหตุผล{selectedReasonDef?.requiresNote && <span className="fmd-required">*</span>}
              </label>
              <textarea
                id="refund-note"
                className={`fmd-input fmd-textarea${errors.note ? ' fmd-input--error' : ''}`}
                placeholder="ระบุเหตุผลการคืนเงิน"
                value={note}
                onChange={e => { setNote(e.target.value); setErrors(prev => ({ ...prev, note: '' })); }}
                disabled={phase === 'submitting'}
                rows={3}
              />
              <div className="fmd-note-counter">{`(${note.length}/200)`}</div>
              {errors.note && <div className="fmd-field-error">{errors.note}</div>}
            </div>
          )}

          {/* ── File upload ── */}
          <div className="fmd-field-group">
            <div className="fmd-section-label">แนบหลักฐาน</div>
            <div className="fmd-file-upload">
              <button
                type="button"
                className={`fmd-file-upload-btn${proofAttached ? ' fmd-file-upload-btn--attached' : ''}`}
                onClick={() => setProofAttached(v => !v)}
                disabled={phase === 'submitting'}
              >
                {proofAttached ? (
                  <>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    แนบไฟล์แล้ว (mock)
                  </>
                ) : (
                  'อัปโหลดไฟล์จากอุปกรณ์'
                )}
              </button>
              <div className="fmd-file-upload-hint">สามารถอัปโหลดไฟล์ JPG, PNG, WEBP ไม่เกิน 2 MB</div>
            </div>
          </div>

          {/* ── Tip alternative — overpay only, before any partial refund ── */}
          {!isManualMode && alreadyRefunded === 0 && onClickTip && (
            <div className="refund-tip-alt">
              <div className="refund-tip-alt-text">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                </svg>
                ไม่ต้องการคืน? บันทึกยอดเกิน{' '}
                <strong>฿{fmt(remainingToRefund)}</strong>{' '}
                เป็น Tip แทนได้
              </div>
              <button
                type="button"
                className="refund-tip-alt-btn"
                onClick={onClickTip}
                disabled={phase === 'submitting'}
              >
                ถือเป็น Tip
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}

          {errors.submit && (
            <div className="fmd-field-error" role="alert">{errors.submit}</div>
          )}

        </div>{/* end fmd-content */}

        {/* ── Footer (fixed outside scroll) ── */}
        <div className="fmd-footer fmd-footer--form">
          <button
            type="button"
            className="fmd-btn fmd-btn--cancel"
            onClick={handleClose}
            disabled={phase === 'submitting'}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className={`fmd-btn fmd-btn--blue${!fieldsComplete || phase === 'submitting' ? ' fmd-btn--disabled' : ''}`}
            disabled={!fieldsComplete || phase === 'submitting'}
          >
            {phase === 'submitting' ? (
              <>
                <span className="dialog-spinner" aria-hidden="true" />
                กำลังส่งคำขอ…
              </>
            ) : cancelMode ? (
              'ถัดไป'
            ) : (
              'ยืนยัน'
            )}
          </button>
        </div>

        </form>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
