'use client';

import { useState, useRef, useEffect } from 'react';
import type { FilterState, DateType } from '@/lib/types';

interface Props {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  activeFilterCount: number;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  onClearAll: () => void;
}

// ── Date presets ──────────────────────────────────────────────────────────────

type Preset = { key: string; label: string; dateType: DateType; from: () => Date; to: () => Date };

const PRESETS: Preset[] = [
  { key: 'today',   label: 'วันนี้',           dateType: 'transaction_created', from: () => new Date(), to: () => new Date() },
  { key: 'yest',    label: 'เมื่อวาน',          dateType: 'transaction_created', from: () => { const d = new Date(); d.setDate(d.getDate()-1); return d; }, to: () => { const d = new Date(); d.setDate(d.getDate()-1); return d; } },
  { key: '7d',      label: '7 วันที่ผ่านมา',   dateType: 'transaction_created', from: () => { const d = new Date(); d.setDate(d.getDate()-6); return d; }, to: () => new Date() },
  { key: '30d',     label: '30 วันที่ผ่านมา',  dateType: 'transaction_created', from: () => { const d = new Date(); d.setDate(d.getDate()-29); return d; }, to: () => new Date() },
  { key: 'month',   label: 'เดือนนี้',          dateType: 'transaction_created', from: () => { const d = new Date(); d.setDate(1); return d; }, to: () => new Date() },
  { key: 'slip7d',  label: '7 วัน (วันส่ง slip)', dateType: 'slip_submitted', from: () => { const d = new Date(); d.setDate(d.getDate()-6); return d; }, to: () => new Date() },
];

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function formatDateTH(iso: string) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function detectPresetKey(filters: FilterState): string | null {
  for (const p of PRESETS) {
    if (p.dateType !== filters.dateType) continue;
    const from = toISO(p.from());
    const to   = toISO(p.to());
    if (from === filters.dateFrom && to === filters.dateTo) return p.key;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchFilterBar({
  filters, onFiltersChange,
  activeFilterCount, isFilterOpen, onToggleFilter, onClearAll,
}: Props) {
  const [showDateDrop, setShowDateDrop] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  // Close date dropdown on outside click
  useEffect(() => {
    if (!showDateDrop) return;
    const handler = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDateDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDateDrop]);

  const hasAny = activeFilterCount > 0 || !!filters.search || !!(filters.dateFrom || filters.dateTo);
  const activePreset = detectPresetKey(filters);

  const dateLabel = (() => {
    if (activePreset) {
      const p = PRESETS.find(x => x.key === activePreset);
      return p?.label ?? 'เลือกช่วงวันที่';
    }
    if (filters.dateFrom || filters.dateTo) {
      if (filters.dateFrom && filters.dateTo) {
        return `${formatDateTH(filters.dateFrom)} – ${formatDateTH(filters.dateTo)}`;
      }
      return filters.dateFrom ? `จาก ${formatDateTH(filters.dateFrom)}` : `ถึง ${formatDateTH(filters.dateTo)}`;
    }
    return 'เลือกช่วงวันที่';
  })();

  const hasDateFilter = !!(filters.dateFrom || filters.dateTo);

  const applyPreset = (preset: Preset) => {
    onFiltersChange({
      ...filters,
      dateType: preset.dateType,
      dateFrom: toISO(preset.from()),
      dateTo:   toISO(preset.to()),
    });
    setShowDateDrop(false);
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFiltersChange({ ...filters, dateFrom: '', dateTo: '' });
  };

  return (
    <div className="toolbar" style={{ gap: 8 }}>

      {/* ── Date range picker ─────────────────────────────────────── */}
      <div ref={dateRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className={`date-range-btn${hasDateFilter ? ' active' : ''}`}
          onClick={() => setShowDateDrop(p => !p)}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <span style={{ fontSize: 14 }}>{dateLabel}</span>
          {hasDateFilter && (
            <span
              onClick={clearDate}
              style={{ marginLeft: 4, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1, fontSize: 14 }}
              title="ล้างวันที่"
            >
              ×
            </span>
          )}
        </button>

        {showDateDrop && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 6px',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            minWidth: 220,
          }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                className={`date-preset-btn${activePreset === p.key ? ' active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
                {p.dateType === 'slip_submitted' && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--brand)', background: 'var(--brand-light)', padding: '1px 6px', borderRadius: 10 }}>slip</span>
                )}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0', padding: '6px 8px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>กำหนดเอง</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="date"
                  className="filter-input"
                  style={{ flex: 1, fontSize: 13, height: 32 }}
                  value={filters.dateFrom}
                  onChange={e => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>–</span>
                <input
                  type="date"
                  className="filter-input"
                  style={{ flex: 1, fontSize: 13, height: 32 }}
                  value={filters.dateTo}
                  onChange={e => onFiltersChange({ ...filters, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Search field ───────────────────────────────────────────── */}
      <div className="search-input-wrap" style={{ flex: 1 }}>
        <svg className="search-icon-abs" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="ค้นหาด้วย Transaction No (เช่น TXN-20260505-X7K2M9 หรือ X7K2M9)"
          value={filters.search}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value.toUpperCase() })}
        />
      </div>

      {/* ── Filter modal toggle ─────────────────────────────────────── */}
      <button
        className={`filter-btn${isFilterOpen ? ' active' : ''}`}
        onClick={onToggleFilter}
      >
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
        ตัวกรอง
        {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
      </button>

      {/* ── Clear all ──────────────────────────────────────────────── */}
      {hasAny && (
        <button
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--brand)', fontSize: 14, fontFamily: 'inherit',
            fontWeight: 600, padding: '0 8px', borderRadius: 8, flexShrink: 0,
          }}
          onClick={onClearAll}
        >
          ล้างทั้งหมด
        </button>
      )}
    </div>
  );
}
