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

// ── Refund reasons (PAT-2036) ─────────────────────────────────────────────────

type RefundReasonCode =
  | 'overpay'
  | 'cashier_error'
  | 'product_issue'
  | 'out_of_stock'
  | 'order_cancel'
  | 'other';

const REFUND_REASONS: {
  value: RefundReasonCode;
  label: string;
  hint?: string;
  requiresNote: boolean;
}[] = [
  {
    value: 'overpay',
    label: 'ชำระเกิน',
    hint: 'ลูกค้าโอนเกินยอดสั่งซื้อ',
    requiresNote: false,
  },
  {
    value: 'cashier_error',
    label: 'คิดเงินผิด / แก้ไขยอดโดย Cashier',
    hint: 'บันทึกยอดผิดหรือมีการแก้ไขราคาสินค้า',
    requiresNote: false,
  },
  {
    value: 'product_issue',
    label: 'สินค้ามีปัญหา / ลูกค้าขอเคลม',
    hint: 'สินค้าชำรุด ผิดรุ่น หรือไม่ตรงสเปค — กรุณาระบุรายละเอียดในหมายเหตุ',
    requiresNote: true,
  },
  {
    value: 'out_of_stock',
    label: 'สินค้าหมดสต็อก (พบทีหลัง)',
    hint: 'ชำระแล้วแต่ของหมดก่อนจัดส่ง',
    requiresNote: false,
  },
  {
    value: 'order_cancel',
    label: 'ยกเลิก Order หลังชำระ',
    hint: 'ลูกค้าหรือ Seller ขอยกเลิกหลังจ่ายแล้ว',
    requiresNote: false,
  },
  {
    value: 'other',
    label: 'อื่นๆ',
    hint: 'กรุณาระบุรายละเอียดในหมายเหตุ',
    requiresNote: true,
  },
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

// ── Eligible payment (BANK_TRANSFER that can receive a refund) ────────────────

export interface EligiblePayment {
  payment_id: string;
  seq: number;
  amount: number;
  payment_channel?: PaymentChannel;
  bank_name?: string;
  account_number?: string;
  refunds?: RefundRecord[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

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
  cancelMode?: boolean;        // true = ยกเลิกออเดอร์ flow; false/undefined = overpay refund flow
  preFilledReason?: string;    // เหตุผลจาก OMS — ถ้าระบุจะซ่อน reason selector
  onSuccess: (result: RefundSubmitResult) => void;
  onClose: () => void;
  onClickTip?: () => void;     // overpay-only: switch to TipConfirmDialog instead
}

// ── Component ─────────────────────────────────────────────────────────────────

type DialogPhase = 'form' | 'submitting' | 'success';

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
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<DialogPhase>('form');

  // cancelMode = full order cancellation (always treat as manual — refund up to full amount)
  // isManualMode = no fixed overpay amount to return; Finance enters amount manually
  const isManualMode = cancelMode || overpayDelta <= 0;
  const remainingToRefund = overpayDelta - alreadyRefunded;

  // form fields
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [reason, setReason] = useState<RefundReasonCode | ''>('');
  const [amount, setAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [note, setNote] = useState('');
  const [proofAttached, setProofAttached] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successResult, setSuccessResult] = useState<RefundSubmitResult | null>(null);

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('form');
      const initPayId = preSelectedPaymentId ?? eligiblePayments[0]?.payment_id ?? '';
      setSelectedPaymentId(initPayId);
      setReason(preFilledReason ? (preFilledReason as RefundReasonCode) : isManualMode ? '' : 'overpay');

      if (isManualMode) {
        const selPay = eligiblePayments.find(p => p.payment_id === initPayId);
        const alrdyOnSel = (selPay?.refunds ?? []).reduce((s, r) => s + r.amount, 0);
        const maxAmt = (selPay?.amount ?? 0) - alrdyOnSel;
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
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-fill bank account from slip when payment is selected
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

  // Derived
  const selectedPayment = eligiblePayments.find(p => p.payment_id === selectedPaymentId);
  const alreadyOnSelected = (selectedPayment?.refunds ?? []).reduce((s, r) => s + r.amount, 0);
  const maxAmount = isManualMode
    ? (selectedPayment?.amount ?? 0) - alreadyOnSelected
    : remainingToRefund;
  const selectedReasonDef = REFUND_REASONS.find(r => r.value === reason);
  const numAmount = parseFloat(amount.replace(/,/g, ''));

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedPaymentId) next.payment = 'กรุณาเลือกช่องทางที่จะโอนคืน';
    // reason required only in cancel/manual mode; overpay or preFilledReason auto-sets reason
    if (isManualMode && !preFilledReason && !reason) next.reason = 'กรุณาเลือกเหตุผลในการคืนเงิน';
    if (selectedReasonDef?.requiresNote && !note.trim()) {
      next.note = 'กรุณาระบุรายละเอียดสำหรับเหตุผลนี้';
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      next.amount = 'กรุณาระบุยอดที่ต้องการคืน';
    } else if (numAmount > maxAmount + 0.001) {
      next.amount = `ยอดสูงสุดที่คืนได้คือ ฿${fmt(maxAmount)}`;
    }
    if (!accountName.trim()) next.accountName = 'กรุณาระบุชื่อบัญชีปลายทาง';
    if (!bankCode) next.bankCode = 'กรุณาเลือกธนาคาร';
    const digits = bankAccount.replace(/-/g, '');
    if (!digits || !/^\d{10,15}$/.test(digits)) {
      next.bankAccount = 'เลขบัญชีไม่ถูกต้อง (10–15 หลัก)';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPhase('submitting');
    const numAmt = parseFloat(amount.replace(/,/g, ''));
    const bName = bankLabel(bankCode);

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
        refund_id: `refund-${uid()}`,
        payment_id: selectedPaymentId,
        amount: numAmt,
        bank_code: bankCode,
        bank_name: bName,
        account_number: bankAccount.replace(/-/g, ''),
        account_name: accountName.trim(),
        note: note.trim() || undefined,
        proof_url: proofAttached ? '/mock-refund-slip.jpg' : undefined,
        requested_at: new Date().toISOString(),
        requested_by: 'วิไล จันทร์',
        completed_at: new Date(Date.now() + 900_000).toISOString(),
        status: 'COMPLETED',
        finance_task_id: res.finance_task_id,
      };

      const result: RefundSubmitResult = { paymentId: selectedPaymentId, record };
      setSuccessResult(result);
      setPhase('success');

      autoCloseRef.current = setTimeout(() => {
        onSuccess(result);
      }, 1800);
    } catch {
      setErrors({ submit: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
      setPhase('form');
    }
  }

  if (!mounted || !open) return null;

  const fieldsComplete = !!(
    selectedPaymentId &&
    (reason || !isManualMode || !!preFilledReason) &&
    amount &&
    accountName &&
    bankCode &&
    bankAccount &&
    (!selectedReasonDef?.requiresNote || note.trim())
  );

  const content = (
    <>
      <div className="dialog-backdrop" onClick={handleClose} />

      <div
        className="dialog-panel refund-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-dialog-title"
      >
        {/* ── Success phase ── */}
        {phase === 'success' && successResult && (
          <div className="refund-success-state">
            <div className="refund-success-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="refund-success-title">ส่งคำขอคืนเงินสำเร็จ</div>
            <div className="refund-success-detail">
              <span className="refund-success-amount">฿{fmt(successResult.record.amount)}</span>
              {' → '}{successResult.record.bank_name}
            </div>
            <div className="refund-success-account">
              {maskAccount(successResult.record.account_number)} · {successResult.record.account_name}
            </div>
            <div className="refund-success-closing">กำลังปิดอัตโนมัติ…</div>
          </div>
        )}

        {/* ── Form + submitting phases ── */}
        {phase !== 'success' && (
          <>
            {/* Header */}
            <div className="dialog-header">
              <div>
                <div id="refund-dialog-title" className="dialog-title">
                  {cancelMode ? 'ยกเลิกออเดอร์ / คืนเงิน' : 'คืนเงินให้ลูกค้า'}
                </div>
                {preFilledReason ? (
                  <div className="dialog-subtitle refund-manual-badge">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                    </svg>
                    ยกเลิกโดย OMS — เหตุผลถูกระบุมาจากระบบ ระบุข้อมูลบัญชีเพื่อโอนเงินคืน
                  </div>
                ) : cancelMode ? (
                  <div className="dialog-subtitle refund-manual-badge">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                    </svg>
                    ยกเลิกออเดอร์ — คืนเงินผ่านโอนธนาคาร กรุณาระบุเหตุผล
                  </div>
                ) : isManualMode ? (
                  <div className="dialog-subtitle refund-manual-badge">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                    </svg>
                    คืนเงินหลังปิดยอด — กรุณาระบุเหตุผลเพื่อ audit trail
                  </div>
                ) : (
                  <div className="dialog-subtitle">
                    ยอดคงเหลือที่ต้องคืน{' '}
                    <strong className="refund-dialog-remaining">฿{fmt(remainingToRefund)}</strong>
                    {alreadyRefunded > 0 && (
                      <span className="refund-dialog-already"> (คืนแล้ว ฿{fmt(alreadyRefunded)})</span>
                    )}
                  </div>
                )}
              </div>
              <button
                className="dialog-close-btn"
                onClick={handleClose}
                disabled={phase === 'submitting'}
                aria-label="ปิด"
                type="button"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="dialog-body refund-dialog-body" onSubmit={handleSubmit} noValidate>

              {/* ── Reason selector — ซ่อนในโหมด Overpay หรือ OMS-cancelled (เหตุผลถูกส่งมาแล้ว) ── */}
              {isManualMode && preFilledReason && (
                <div className="dialog-field-group">
                  <label className="dialog-label">เหตุผลในการยกเลิก</label>
                  <div className="refund-prefilled-reason">
                    {REFUND_REASONS.find(r => r.value === preFilledReason)?.label ?? preFilledReason}
                  </div>
                </div>
              )}
              {isManualMode && !preFilledReason && (
                <div className="dialog-field-group">
                  <label className="dialog-label">
                    เหตุผลในการยกเลิก / คืนเงิน <span className="dialog-required">*</span>
                  </label>
                  <div className="refund-reason-list">
                    {REFUND_REASONS.filter(r => r.value !== 'overpay').map(r => (
                      <label
                        key={r.value}
                        className={`refund-reason-item${reason === r.value ? ' refund-reason-item--selected' : ''}`}
                      >
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
                          className="refund-reason-radio"
                        />
                        <div className="refund-reason-text-wrap">
                          <span className="refund-reason-label">{r.label}</span>
                          {r.hint && <span className="refund-reason-hint">{r.hint}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.reason && <div className="dialog-field-error">{errors.reason}</div>}
                </div>
              )}

              {/* ── Payment selector ── */}
              <div className="dialog-field-group">
                <label className="dialog-label">
                  เลือกช่องทางที่จะโอนคืน <span className="dialog-required">*</span>
                </label>
                <div className="refund-payment-list">
                  {eligiblePayments.map(p => {
                    const alreadyOnThisPayment = (p.refunds ?? []).reduce((s, r) => s + r.amount, 0);
                    const isSelected = p.payment_id === selectedPaymentId;
                    return (
                      <button
                        key={p.payment_id}
                        type="button"
                        className={`refund-payment-option${isSelected ? ' refund-payment-option--selected' : ''}`}
                        onClick={() => {
                          setSelectedPaymentId(p.payment_id);
                          setErrors(prev => ({ ...prev, payment: '' }));
                          if (isManualMode) {
                            const alrdyOnP = (p.refunds ?? []).reduce((s, r) => s + r.amount, 0);
                            const newMax = p.amount - alrdyOnP;
                            setAmount(newMax > 0 ? String(newMax) : '');
                          }
                        }}
                        disabled={phase === 'submitting'}
                      >
                        <div className="refund-payment-option-header">
                          <div className="refund-payment-option-radio">
                            <div className={`refund-radio-dot${isSelected ? ' refund-radio-dot--on' : ''}`} />
                          </div>
                          <div className="refund-payment-option-info">
                            <div className="refund-payment-seq">
                              รายการที่ {p.seq} —{' '}
                              {p.payment_channel === 'CASH' ? 'เงินสด' : 'โอนผ่านธนาคาร'}
                            </div>
                            <div className="refund-payment-meta">
                              ฿{fmt(p.amount)}
                              {p.bank_name && <span> · {p.bank_name}</span>}
                              {p.account_number && <span> · {maskAccount(p.account_number)}</span>}
                              {p.payment_channel === 'CASH' && (
                                <span className="refund-cash-note"> · คืนผ่านโอนธนาคาร</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {alreadyOnThisPayment > 0 && (
                          <div className="refund-payment-already-tag">
                            คืนแล้ว ฿{fmt(alreadyOnThisPayment)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {errors.payment && <div className="dialog-field-error">{errors.payment}</div>}
              </div>

              {/* ── Amount ── */}
              <div className="dialog-field-group">
                <label htmlFor="refund-amount" className="dialog-label">
                  ยอดที่จะคืน <span className="dialog-required">*</span>
                </label>
                <div className="refund-amount-wrap">
                  <span className="refund-amount-prefix">฿</span>
                  <input
                    id="refund-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    max={maxAmount}
                    className={`dialog-input refund-amount-input${errors.amount ? ' dialog-input--error' : ''}`}
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setErrors(prev => ({ ...prev, amount: '' })); }}
                    disabled={phase === 'submitting'}
                    placeholder={fmt(maxAmount)}
                  />
                </div>
                {errors.amount
                  ? <div className="dialog-field-error">{errors.amount}</div>
                  : <div className="dialog-field-hint">ยอดสูงสุดที่คืนได้ ฿{fmt(maxAmount)}</div>
                }
              </div>

              {/* ── Account name ── */}
              <div className="dialog-field-group">
                <label htmlFor="refund-account-name" className="dialog-label">
                  ชื่อบัญชีปลายทาง <span className="dialog-required">*</span>
                </label>
                <input
                  id="refund-account-name"
                  type="text"
                  className={`dialog-input${errors.accountName ? ' dialog-input--error' : ''}`}
                  placeholder="ชื่อเจ้าของบัญชี เช่น สมชาย ใจดี"
                  value={accountName}
                  onChange={e => { setAccountName(e.target.value); setErrors(prev => ({ ...prev, accountName: '' })); }}
                  disabled={phase === 'submitting'}
                />
                {errors.accountName && <div className="dialog-field-error">{errors.accountName}</div>}
              </div>

              {/* ── Bank code ── */}
              <div className="dialog-field-group">
                <label htmlFor="refund-bank-code" className="dialog-label">
                  ธนาคาร <span className="dialog-required">*</span>
                </label>
                <select
                  id="refund-bank-code"
                  className={`dialog-select${errors.bankCode ? ' dialog-input--error' : ''}`}
                  value={bankCode}
                  onChange={e => { setBankCode(e.target.value); setErrors(prev => ({ ...prev, bankCode: '' })); }}
                  disabled={phase === 'submitting'}
                >
                  <option value="">เลือกธนาคาร</option>
                  {BANK_OPTIONS.map(b => (
                    <option key={b.value} value={b.value}>{b.labelTH}</option>
                  ))}
                </select>
                {errors.bankCode && <div className="dialog-field-error">{errors.bankCode}</div>}
              </div>

              {/* ── Bank account number ── */}
              <div className="dialog-field-group">
                <label htmlFor="refund-bank-account" className="dialog-label">
                  เลขบัญชีธนาคาร <span className="dialog-required">*</span>
                </label>
                <input
                  id="refund-bank-account"
                  type="text"
                  inputMode="numeric"
                  className={`dialog-input${errors.bankAccount ? ' dialog-input--error' : ''}`}
                  placeholder="เลขบัญชี 10–15 หลัก"
                  value={bankAccount}
                  onChange={e => { setBankAccount(e.target.value); setErrors(prev => ({ ...prev, bankAccount: '' })); }}
                  disabled={phase === 'submitting'}
                  maxLength={20}
                />
                {errors.bankAccount
                  ? <div className="dialog-field-error">{errors.bankAccount}</div>
                  : <div className="dialog-field-hint">ตัวเลข 10–15 หลัก (ไม่รวมขีด)</div>
                }
              </div>

              {/* ── Note (required for product_issue / other) ── */}
              <div className="dialog-field-group">
                <label htmlFor="refund-note" className="dialog-label">
                  หมายเหตุ{' '}
                  {selectedReasonDef?.requiresNote
                    ? <span className="dialog-required">*</span>
                    : <span className="refund-optional-tag">(ไม่บังคับ)</span>
                  }
                </label>
                <textarea
                  id="refund-note"
                  className={`dialog-input refund-note-textarea${errors.note ? ' dialog-input--error' : ''}`}
                  placeholder={
                    selectedReasonDef?.requiresNote
                      ? 'กรุณาระบุรายละเอียด เช่น ชื่อสินค้าที่มีปัญหา หรือเหตุผลที่ยกเลิก'
                      : 'เช่น คืนเงินส่วนที่ชำระเกิน งวดที่ 2'
                  }
                  value={note}
                  onChange={e => { setNote(e.target.value); setErrors(prev => ({ ...prev, note: '' })); }}
                  disabled={phase === 'submitting'}
                  rows={2}
                />
                {errors.note && <div className="dialog-field-error">{errors.note}</div>}
              </div>

              {/* ── Proof attachment hint ── */}
              <div className="refund-proof-hint">
                <div className="refund-proof-hint-icon">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4m0-4h.01" />
                  </svg>
                </div>
                <div className="refund-proof-hint-body">
                  <div className="refund-proof-hint-title">แนะนำ: แนบสลิปหลักฐานการโอนคืน</div>
                  <div className="refund-proof-hint-desc">
                    ช่วยให้ลูกค้ายืนยันรายการและลดข้อพิพาทในอนาคต
                  </div>
                  <button
                    type="button"
                    className={`refund-proof-btn${proofAttached ? ' refund-proof-btn--attached' : ''}`}
                    onClick={() => setProofAttached(v => !v)}
                    disabled={phase === 'submitting'}
                  >
                    {proofAttached ? (
                      <>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        แนบสลิปแล้ว (mock)
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                        + แนบสลิปคืนเงิน
                      </>
                    )}
                  </button>
                </div>
              </div>

              {errors.submit && (
                <div className="dialog-field-error" role="alert">{errors.submit}</div>
              )}

              {/* ── Tip alternative — overpay only, only before any partial refund ── */}
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

              {/* ── Footer ── */}
              <div className="dialog-footer">
                <button
                  type="button"
                  className="dialog-btn dialog-btn--cancel"
                  onClick={handleClose}
                  disabled={phase === 'submitting'}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className={`dialog-btn dialog-btn--primary${phase === 'submitting' ? ' dialog-btn--loading' : ''}`}
                  disabled={!fieldsComplete || phase === 'submitting'}
                >
                  {phase === 'submitting' ? (
                    <>
                      <span className="dialog-spinner" aria-hidden="true" />
                      กำลังส่งคำขอ…
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      ยืนยันคืนเงิน ฿{!isNaN(numAmount) && numAmount > 0 ? fmt(numAmount) : '—'}
                    </>
                  )}
                </button>
              </div>

            </form>
          </>
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
