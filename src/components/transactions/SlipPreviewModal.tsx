'use client';

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Slip } from '@/lib/types';

interface Props {
  slip: Slip | null;
  onClose: () => void;
}

export default function SlipPreviewModal({ slip, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    if (!slip) return;
    setClosing(false);
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [slip, handleClose]);

  if (!mounted || !slip) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div className={`slip-backdrop${closing ? ' closing' : ''}`} onClick={handleClose} />

      {/* Modal */}
      <div className={`slip-modal${closing ? ' closing' : ''}`}>

        {/* Header */}
        <div className="slip-modal-header">
          <span className="slip-modal-title">หลักฐานการโอนเงิน</span>
          <button className="slip-modal-close-btn" onClick={handleClose} aria-label="ปิด">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — slip image */}
        <div className="slip-modal-body">
          <img
            src={slip.image_url}
            alt="สลิปโอนเงิน"
            className="slip-modal-img"
            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
          />
        </div>

        {/* Footer */}
        <div className="slip-modal-footer">
          <button className="slip-btn-secondary" onClick={handleClose}>ปิด</button>
        </div>

      </div>
    </>
  );

  return createPortal(content, document.body);
}
