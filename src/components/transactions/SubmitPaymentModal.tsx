'use client';

/**
 * PAT-2044 — Submit Payment to Transaction
 *
 * Modal สำหรับ Cashier/Seller บันทึกการรับชำระเงิน
 * รองรับ: Cash, Bank Transfer (with slip upload), Multi-Tender
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Transaction, Payment, PaymentStatus } from '@/lib/types';

// ── Bank list (store-enabled banks — mock: ทุก store มีเหมือนกัน) ────────────

const STORE_BANKS = [
  { code: '014', nameTH: 'ไทยพาณิชย์ (SCB)' },
  { code: '004', nameTH: 'กสิกรไทย (KBANK)' },
  { code: '006', nameTH: 'กรุงไทย (KTB)' },
  { code: '002', nameTH: 'กรุงเทพ (BBL)' },
  { code: '025', nameTH: 'กรุงศรี (BAY)' },
];

const BANK_NAMES: Record<string, string> = {
  '014': 'ธนาคารไทยพาณิชย์',
  '004': 'ธนาคารกสิกรไทย',
  '006': 'ธนาคารกรุงไทย',
  '002': 'ธนาคารกรุงเทพ',
  '025': 'ธนาคารกรุงศรีอยุธยา',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubmittedPayment {
  id: string;
  method: 'cash' | 'bank';
  amount: number;
  bankCode?: string;
  transferredAt?: string; // UTC ISO
  slipPreview?: string;   // base64 thumbnail
  status: PaymentStatus;
}

export interface SubmitPaymentResult {
  payments: SubmittedPayment[];
  /** ยอดรวม COMPLETED — ถ้า >= tx.amount แปลว่า CLOSED */
  completedTotal: number;
}

interface Props {
  open: boolean;
  tx: Transaction;
  onSuccess: (result: SubmitPaymentResult) => void;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Convert UTC ISO → Bangkok datetime-local string "YYYY-MM-DDTHH:MM" */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(0, 16);
}

/** Convert datetime-local string (Bangkok) → UTC ISO */
function bangkokLocalToUTC(local: string): string {
  return new Date(local + ':00.000+07:00').toISOString();
}

/** Generate client-side thumbnail via Canvas API */
async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 240;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width = Math.round(width * MAX / height);  height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Mock API: submit payment (800ms delay) */
async function mockSubmitPayment(params: {
  txId: string;
  method: 'cash' | 'bank';
  amount: number;
  bankCode?: string;
  transferredAtUTC?: string;
  hasSlip?: boolean;
}): Promise<{ payment_id: string; payment_status: PaymentStatus }> {
  await new Promise(r => setTimeout(r, 800));
  const status: PaymentStatus = params.method === 'cash' ? 'COMPLETED' : 'UNDER_REVIEW';
  return { payment_id: `pay-${Math.random().toString(36).slice(2, 10)}`, payment_status: status };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MethodTab({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`spm-method-tab${active ? ' spm-method-tab--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FieldGroup({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="spm-field-group">
      <label className="spm-label">
        {label}{required && <span className="spm-required"> *</span>}
      </label>
      {children}
      {error && <div className="spm-field-error" role="alert">{error}</div>}
      {!error && hint && <div className="spm-field-hint">{hint}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubmitPaymentModal({ open, tx, onSuccess, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  // ── Form state ──
  const [method, setMethod]           = useState<'cash' | 'bank'>('cash');
  const [amount, setAmount]           = useState('');
  const [bankCode, setBankCode]       = useState('');
  const [transferredAt, setTransferredAt] = useState(''); // Bangkok datetime-local
  const [slip, setSlip]               = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // ── Field errors ──
  const [amountErr, setAmountErr]         = useState('');
  const [bankErr, setBankErr]             = useState('');
  const [dateErr, setDateErr]             = useState('');
  const [slipErr, setSlipErr]             = useState('');

  // ── Session payments (multi-tender) ──
  const [sessionPayments, setSessionPayments] = useState<SubmittedPayment[]>([]);

  useEffect(() => setMounted(true), []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMethod('cash');
      setAmount('');
      setBankCode('');
      setTransferredAt(toDatetimeLocal(new Date().toISOString())); // default = now Bangkok
      setSlip(null);
      setSlipPreview(null);
      setAmountErr('');
      setBankErr('');
      setDateErr('');
      setSlipErr('');
      setSubmitting(false);
      setSessionPayments([]);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, handleClose]);

  // ── Computed values ───────────────────────────────────────────────────────

  // ยอดที่ COMPLETED อยู่แล้วในระบบ (ก่อนเปิด modal)
  const preExistingCompleted = (() => {
    if (tx.payments && tx.payments.length > 0) {
      return tx.payments.filter(p => p.payment_status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
    }
    return tx.payment_status === 'COMPLETED' ? tx.amount : 0;
  })();

  // ยอดที่ COMPLETED จาก session นี้
  const sessionCompleted = sessionPayments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
  const totalCompleted = preExistingCompleted + sessionCompleted;
  const remaining = Math.max(0, tx.amount - totalCompleted);

  // Datetime constraints (Bangkok local)
  const nowLocal = toDatetimeLocal(new Date().toISOString());
  const sevenDaysAgoUTC = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const minDateUTC = new Date(Math.max(
    new Date(sevenDaysAgoUTC).getTime(),
    new Date(tx.created_at).getTime(),
  )).toISOString();
  const minLocal = toDatetimeLocal(minDateUTC);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function resetForm() {
    setAmount('');
    setBankCode('');
    setTransferredAt(toDatetimeLocal(new Date().toISOString()));
    setSlip(null);
    setSlipPreview(null);
    setAmountErr('');
    setBankErr('');
    setDateErr('');
    setSlipErr('');
  }

  async function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setSlipErr('รองรับเฉพาะไฟล์ JPG และ PNG');
      e.target.value = '';
      return;
    }
    // Validate size (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setSlipErr('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 2 MB)');
      e.target.value = '';
      return;
    }

    setSlipErr('');
    setSlip(file);
    try {
      const preview = await generateThumbnail(file);
      setSlipPreview(preview);
    } catch {
      setSlipPreview(null);
    }
  }

  function removeSlip() {
    setSlip(null);
    setSlipPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function validateTransferredAt(val: string): string {
    if (!val) return 'กรุณาระบุวันที่และเวลาโอน';
    if (val > nowLocal) return 'วันเวลาโอนต้องไม่เกินเวลาปัจจุบัน';
    if (val < minLocal) {
      const minDate = new Date(minDateUTC);
      const txDate  = new Date(tx.created_at);
      if (minDate.getTime() === txDate.getTime()) {
        return 'วันเวลาโอนต้องไม่ก่อนวันสร้างออเดอร์';
      }
      return 'ไม่สามารถบันทึกการโอนที่เกิดขึ้นเกิน 7 วัน';
    }
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ── Validate ──
    let ok = true;

    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (!amount || isNaN(parsedAmount)) {
      setAmountErr('กรุณาระบุยอดเงิน'); ok = false;
    } else if (parsedAmount <= 0) {
      setAmountErr('ยอดเงินต้องมากกว่า 0'); ok = false;
    } else {
      setAmountErr('');
    }

    if (method === 'bank') {
      if (!bankCode) { setBankErr('กรุณาเลือกธนาคาร'); ok = false; } else setBankErr('');

      const dtErr = validateTransferredAt(transferredAt);
      setDateErr(dtErr);
      if (dtErr) ok = false;

      if (!slip) { setSlipErr('กรุณาแนบสลิป'); ok = false; } else setSlipErr('');
    }

    if (!ok) return;

    setSubmitting(true);
    try {
      const transferredAtUTC = method === 'bank' ? bangkokLocalToUTC(transferredAt) : undefined;

      const res = await mockSubmitPayment({
        txId: tx.transaction_id,
        method,
        amount: parsedAmount,
        bankCode: method === 'bank' ? bankCode : undefined,
        transferredAtUTC,
        hasSlip: method === 'bank' && !!slip,
      });

      const newPayment: SubmittedPayment = {
        id: res.payment_id,
        method,
        amount: parsedAmount,
        bankCode: method === 'bank' ? bankCode : undefined,
        transferredAt: transferredAtUTC,
        slipPreview: slipPreview ?? undefined,
        status: res.payment_status,
      };

      const newSessionPayments = [...sessionPayments, newPayment];
      setSessionPayments(newSessionPayments);

      const newSessionCompleted = newSessionPayments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
      const newTotalCompleted = preExistingCompleted + newSessionCompleted;

      // If remaining is now 0 or less (closed) or user wants to close
      onSuccess({ payments: newSessionPayments, completedTotal: newTotalCompleted });

      // Reset form for next payment in multi-tender, unless already closed
      if (newTotalCompleted < tx.amount) {
        resetForm();
      }

    } catch {
      setAmountErr('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  const isClosed = remaining <= 0 && sessionPayments.length > 0;

  const content = (
    <>
      <div className="dialog-backdrop" onClick={handleClose} />

      <div className="dialog-panel spm-panel" role="dialog" aria-modal="true" aria-labelledby="spm-title">

        {/* ── Header ── */}
        <div className="spm-header">
          <div>
            <div id="spm-title" className="spm-title">บันทึกการรับชำระเงิน</div>
            <div className="spm-tx-ref">{tx.transaction_no}</div>
          </div>
          <button className="dialog-close-btn" onClick={handleClose} disabled={submitting} type="button" aria-label="ปิด">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Summary bar ── */}
        <div className="spm-summary-bar">
          <div className="spm-summary-item">
            <span className="spm-summary-label">ยอดรวม</span>
            <span className="spm-summary-value">฿{formatAmount(tx.amount)}</span>
          </div>
          <div className="spm-summary-item">
            <span className="spm-summary-label">ชำระแล้ว</span>
            <span className="spm-summary-value spm-summary-value--paid">฿{formatAmount(totalCompleted)}</span>
          </div>
          <div className="spm-summary-item">
            <span className="spm-summary-label">{remaining <= 0 ? 'ชำระครบ' : 'คงเหลือ'}</span>
            <span className={`spm-summary-value ${remaining <= 0 ? 'spm-summary-value--done' : 'spm-summary-value--remain'}`}>
              {remaining <= 0 ? '✓ ครบแล้ว' : `฿${formatAmount(remaining)}`}
            </span>
          </div>
        </div>

        {/* ── Submitted payments list (multi-tender history) ── */}
        {sessionPayments.length > 0 && (
          <div className="spm-history">
            <div className="spm-history-title">รายการที่บันทึกแล้ว</div>
            {sessionPayments.map((p, i) => (
              <div key={p.id} className="spm-history-row">
                <div className="spm-history-seq">{i + 1}</div>
                <div className="spm-history-info">
                  <span className="spm-history-method">
                    {p.method === 'cash' ? '💵 เงินสด' : `🏦 ${BANK_NAMES[p.bankCode!] ?? p.bankCode}`}
                  </span>
                  {p.slipPreview && (
                    <img src={p.slipPreview} alt="thumbnail" className="spm-history-thumb" />
                  )}
                </div>
                <div className="spm-history-amount">฿{formatAmount(p.amount)}</div>
                <span className={`spm-history-badge ${p.status === 'COMPLETED' ? 'spm-badge--completed' : 'spm-badge--review'}`}>
                  {p.status === 'COMPLETED' ? 'ชำระแล้ว' : 'รอตรวจสอบ'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Form (ซ่อนเมื่อ closed) ── */}
        {isClosed ? (
          <div className="spm-closed-state">
            <div className="spm-closed-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="spm-closed-title">ชำระเงินครบแล้ว</div>
            <div className="spm-closed-sub">Transaction จะเปลี่ยนสถานะเป็น "ชำระเงินแล้ว"</div>
            <button className="dialog-btn dialog-btn--primary spm-done-btn" onClick={handleClose} type="button">
              ปิด
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* ── Method tabs ── */}
            <div className="spm-method-tabs">
              <MethodTab active={method === 'cash'} onClick={() => { setMethod('cash'); setAmountErr(''); setBankErr(''); setDateErr(''); setSlipErr(''); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20M6 14h4" strokeLinecap="round" />
                </svg>
                เงินสด
              </MethodTab>
              <MethodTab active={method === 'bank'} onClick={() => { setMethod('bank'); setAmountErr(''); setBankErr(''); setDateErr(''); setSlipErr(''); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
                </svg>
                โอนเงิน
              </MethodTab>
            </div>

            <div className="spm-form-body">

              {/* ── Cash fields ── */}
              {method === 'cash' && (
                <FieldGroup label="ยอดเงิน" required error={amountErr}>
                  <div className="spm-amount-wrap">
                    <span className="spm-currency">฿</span>
                    <input
                      type="number"
                      className={`spm-input spm-input--amount${amountErr ? ' spm-input--error' : ''}`}
                      placeholder="0.00"
                      value={amount}
                      min="0.01"
                      step="0.01"
                      onChange={e => { setAmount(e.target.value); if (amountErr) setAmountErr(''); }}
                      disabled={submitting}
                      autoFocus
                    />
                  </div>
                </FieldGroup>
              )}

              {/* ── Bank Transfer fields ── */}
              {method === 'bank' && (
                <>
                  <FieldGroup label="ธนาคาร" required error={bankErr}>
                    <select
                      className={`spm-select${bankErr ? ' spm-input--error' : ''}`}
                      value={bankCode}
                      onChange={e => { setBankCode(e.target.value); if (bankErr) setBankErr(''); }}
                      disabled={submitting}
                    >
                      <option value="">เลือกธนาคาร</option>
                      {STORE_BANKS.map(b => (
                        <option key={b.code} value={b.code}>{b.nameTH}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="ยอดเงิน" required error={amountErr}>
                    <div className="spm-amount-wrap">
                      <span className="spm-currency">฿</span>
                      <input
                        type="number"
                        className={`spm-input spm-input--amount${amountErr ? ' spm-input--error' : ''}`}
                        placeholder="0.00"
                        value={amount}
                        min="0.01"
                        step="0.01"
                        onChange={e => { setAmount(e.target.value); if (amountErr) setAmountErr(''); }}
                        disabled={submitting}
                      />
                    </div>
                  </FieldGroup>

                  <FieldGroup
                    label="วันที่และเวลาที่โอน"
                    required
                    error={dateErr}
                    hint="แสดงเป็นเวลาประเทศไทย (UTC+7)"
                  >
                    <input
                      type="datetime-local"
                      className={`spm-input${dateErr ? ' spm-input--error' : ''}`}
                      value={transferredAt}
                      max={nowLocal}
                      min={minLocal}
                      onChange={e => {
                        setTransferredAt(e.target.value);
                        if (dateErr) setDateErr(validateTransferredAt(e.target.value));
                      }}
                      onBlur={() => setDateErr(validateTransferredAt(transferredAt))}
                      disabled={submitting}
                    />
                  </FieldGroup>

                  <FieldGroup label="สลิปการโอนเงิน" required error={slipErr} hint="JPG, PNG — สูงสุด 2 MB">
                    {slipPreview ? (
                      <div className="spm-slip-preview">
                        <img src={slipPreview} alt="สลิป" className="spm-slip-thumb" />
                        <div className="spm-slip-info">
                          <div className="spm-slip-name">{slip?.name}</div>
                          <div className="spm-slip-size">{slip ? `${(slip.size / 1024).toFixed(0)} KB` : ''}</div>
                        </div>
                        <button
                          type="button"
                          className="spm-slip-remove"
                          onClick={removeSlip}
                          disabled={submitting}
                          aria-label="ลบสลิป"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <label className={`spm-slip-dropzone${slipErr ? ' spm-slip-dropzone--error' : ''}`}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png"
                          className="spm-slip-input"
                          onChange={handleSlipChange}
                          disabled={submitting}
                        />
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4a3 3 0 014 0l4 4m-4-8v8M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                        <span className="spm-slip-dropzone-label">คลิกเพื่อเลือกไฟล์สลิป</span>
                        <span className="spm-slip-dropzone-hint">JPG, PNG สูงสุด 2 MB</span>
                      </label>
                    )}
                  </FieldGroup>
                </>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="spm-footer">
              <button type="button" className="dialog-btn dialog-btn--cancel" onClick={handleClose} disabled={submitting}>
                {sessionPayments.length > 0 ? 'ปิด' : 'ยกเลิก'}
              </button>
              <button
                type="submit"
                className={`dialog-btn dialog-btn--primary${submitting ? ' dialog-btn--loading' : ''}`}
                disabled={submitting}
              >
                {submitting
                  ? <><span className="dialog-spinner" aria-hidden="true" />กำลังบันทึก…</>
                  : 'ยืนยัน'
                }
              </button>
            </div>
          </form>
        )}

      </div>
    </>
  );

  return createPortal(content, document.body);
}
