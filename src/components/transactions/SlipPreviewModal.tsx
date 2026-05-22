'use client';

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Slip } from '@/lib/types';

interface Props {
  slip: Slip | null;
  onClose: () => void;
}

function formatTH(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${date} เวลา ${time}`;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function SlipPreviewModal({ slip, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    if (!slip) return;
    setClosing(false);
    setImgError(false);
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [slip, handleClose]);

  const handleDownload = () => {
    if (!slip) return;
    const a = document.createElement('a');
    a.href = slip.image_url;
    a.download = `slip-${slip.slip_id}.jpg`;
    a.target = '_blank';
    a.click();
  };

  if (!mounted || !slip) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={`slip-backdrop${closing ? ' closing' : ''}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`slip-modal${closing ? ' closing' : ''}`}>

        {/* Header */}
        <div className="slip-modal-header">
          <span className="slip-modal-title">สลิป</span>
          <button className="slip-modal-close-btn" onClick={handleClose} aria-label="ปิด">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="slip-modal-body">

          {/* Slip image */}
          <div className="slip-image-area">
            {imgError ? (
              <div className="slip-image-placeholder">
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                <span style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 8 }}>ไม่สามารถโหลดรูปได้</span>
              </div>
            ) : (
              <img
                src={slip.image_url}
                alt="สลิปการโอนเงิน"
                className="slip-image"
                onError={() => setImgError(true)}
              />
            )}
          </div>

          {/* Details */}
          <div className="slip-detail-box">
            <div className="slip-detail-row">
              <span className="slip-detail-label">ยอดเงิน</span>
              <span className="slip-detail-value slip-detail-brand">฿{formatAmount(slip.amount)}</span>
            </div>
            {slip.transfer_time && (
              <div className="slip-detail-row">
                <span className="slip-detail-label">วันที่ชำระเงิน</span>
                <span className="slip-detail-value">{formatTH(slip.transfer_time)}</span>
              </div>
            )}
            <div className="slip-detail-row">
              <span className="slip-detail-label">วันที่อัปโหลดสลิป</span>
              <span className="slip-detail-value">{formatTH(slip.uploaded_at)}</span>
            </div>
            {(slip.bank_name || slip.account_number) && (
              <div className="slip-detail-divider" />
            )}
            {slip.bank_name && (
              <div className="slip-detail-row">
                <span className="slip-detail-label">ธนาคารที่รับเงิน</span>
                <span className="slip-detail-value">{slip.bank_name}</span>
              </div>
            )}
            {slip.account_number && (
              <div className="slip-detail-row">
                <span className="slip-detail-label">เลขที่บัญชีที่รับเงิน</span>
                <span className="slip-detail-value">{slip.account_number}</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="slip-modal-footer">
          <button className="slip-btn-secondary" onClick={handleClose}>ปิด</button>
          <button className="slip-btn-primary" onClick={handleDownload}>ดาวน์โหลด</button>
        </div>

      </div>
    </>
  );

  return createPortal(content, document.body);
}
