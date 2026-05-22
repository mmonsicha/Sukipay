'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FilterState, PaymentChannel, Store, TabKey } from '@/lib/types';
import { DEFAULT_FILTERS } from '@/lib/types';

interface Props {
  open: boolean;
  filters: FilterState;          // currently-applied filters
  onApply: (f: FilterState) => void;
  onClose: () => void;
  stores: Store[];
  activeTab: TabKey;
}

const CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'โอนผ่านธนาคาร' },
  { value: 'CASH',          label: 'เงินสด' },
  { value: 'CREDIT',        label: 'เครดิต' },
  { value: 'COD',           label: 'COD' },
];

// ── Checkmark SVG ─────────────────────────────────────────────────────────────
function Checkmark() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1.5 5.5L4 8L9.5 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── FilterModal ───────────────────────────────────────────────────────────────

export default function FilterModal({ open, filters, onApply, onClose, stores, activeTab }: Props) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  // Local draft — changes are not applied until "นำไปใช้"
  const [draft, setDraft] = useState<FilterState>(filters);
  const [storeSearch, setStoreSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Sync draft from applied filters when modal opens
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setStoreSearch('');
      setClosing(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animated close
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  // Adaptive visibility per PAT-2039
  const showPaymentMethod = activeTab !== 'PENDING';

  const toggleChannel = (ch: PaymentChannel) => {
    setDraft(prev => ({
      ...prev,
      paymentChannels: prev.paymentChannels.includes(ch)
        ? prev.paymentChannels.filter(c => c !== ch)
        : [...prev.paymentChannels, ch],
    }));
  };

  const toggleStore = (id: string) => {
    setDraft(prev => ({
      ...prev,
      storeIds: prev.storeIds.includes(id)
        ? prev.storeIds.filter(s => s !== id)
        : [...prev.storeIds, id],
    }));
  };

  // Clear only the modal-managed fields; preserve date fields (those live in toolbar)
  const handleClear = () => {
    setDraft(prev => ({
      ...DEFAULT_FILTERS,
      dateType: prev.dateType,
      dateFrom: prev.dateFrom,
      dateTo:   prev.dateTo,
    }));
    setStoreSearch('');
  };

  const handleApply = () => {
    onApply(draft);
    setClosing(true);
    setTimeout(onClose, 220);
  };

  const filteredStores = stores.filter(s =>
    !storeSearch || s.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  // Count active filters in draft (for empty-state visual feedback)
  const draftCount = [
    draft.paymentChannels.length > 0,
    !!(draft.amountMin || draft.amountMax),
    draft.storeIds.length > 0,
  ].filter(Boolean).length;

  if (!mounted || !open) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={`fm-backdrop${closing ? ' closing' : ''}`}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div className={`fm-drawer${closing ? ' closing' : ''}`}>

        {/* Header */}
        <div className="fm-header">
          <span className="fm-title">ตัวกรอง</span>
          <button className="fm-close-btn" onClick={handleClose} aria-label="ปิด">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="fm-body">

          {/* ── Amount range ─────────────────────────────────────────── */}
          <section>
            <p className="fm-section-title">ช่วงยอดเงิน</p>
            <div className="fm-amount-row">
              <input
                type="number"
                placeholder="ต่ำสุด"
                min={0}
                value={draft.amountMin}
                onChange={e => setDraft(p => ({ ...p, amountMin: e.target.value }))}
                className="fm-input"
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: 14, flexShrink: 0 }}>–</span>
              <input
                type="number"
                placeholder="สูงสุด"
                min={0}
                value={draft.amountMax}
                onChange={e => setDraft(p => ({ ...p, amountMax: e.target.value }))}
                className="fm-input"
              />
            </div>
          </section>

          {/* ── Payment method (hidden for รอชำระ tab) ────────────── */}
          {showPaymentMethod && (
            <section>
              <p className="fm-section-title">ช่องทางชำระ</p>
              <div className="fm-check-list">
                {CHANNELS.map(({ value, label }) => {
                  const checked = draft.paymentChannels.includes(value);
                  return (
                    <label key={value} className="fm-check-item" onClick={() => toggleChannel(value)}>
                      <span className={`fm-checkbox${checked ? ' checked' : ''}`}>
                        {checked && <Checkmark />}
                      </span>
                      <span className="fm-check-label">{label}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Store with search ────────────────────────────────────── */}
          <section>
            <p className="fm-section-title">ร้านค้า</p>
            <div className="fm-store-search-wrap">
              <svg className="fm-store-search-icon" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="ค้นหาร้านค้า"
                value={storeSearch}
                onChange={e => setStoreSearch(e.target.value)}
                className="fm-store-search"
              />
            </div>
            <div className="fm-store-list">
              {filteredStores.length === 0 ? (
                <div style={{ padding: '16px 14px', fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  ไม่พบร้านค้า
                </div>
              ) : filteredStores.map(store => {
                const checked = draft.storeIds.includes(store.id);
                return (
                  <label key={store.id} className="fm-store-item" onClick={() => toggleStore(store.id)}>
                    <span className={`fm-checkbox${checked ? ' checked' : ''}`}>
                      {checked && <Checkmark />}
                    </span>
                    <span className="fm-store-label">{store.name}</span>
                  </label>
                );
              })}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="fm-footer">
          <button className="fm-btn fm-btn-clear" onClick={handleClear}>
            ล้างทั้งหมด
          </button>
          <button
            className="fm-btn fm-btn-apply"
            onClick={handleApply}
          >
            {draftCount > 0 ? `นำไปใช้ (${draftCount})` : 'นำไปใช้'}
          </button>
        </div>

      </div>
    </>
  );

  return createPortal(content, document.body);
}
