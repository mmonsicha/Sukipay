'use client';

import type { FilterState, PaymentChannel, Store, TabKey, DateType } from '@/lib/types';

interface Props {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onClear: () => void;
  stores: Store[];
  activeTab: TabKey;
}

const CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: 'BANK_TRANSFER', label: '🏦 โอนผ่านธนาคาร' },
  { value: 'CASH',          label: '💵 เงินสด' },
  { value: 'CREDIT',        label: '💳 เครดิต' },
  { value: 'COD',           label: '📦 COD' },
];

// ── Preset date ranges ────────────────────────────────────────────────────────

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

function calcPreset(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const today = new Date();
  let from = new Date(today);
  let to = new Date(today);

  switch (preset) {
    case 'TODAY':   break;
    case 'YESTERDAY':
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;
    case 'LAST_7_DAYS':
      from.setDate(from.getDate() - 6);
      break;
    case 'LAST_30_DAYS':
      from.setDate(from.getDate() - 29);
      break;
    case 'THIS_MONTH':
      from.setDate(1);
      break;
    case 'LAST_MONTH':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to   = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'CUSTOM':
      return { dateFrom: '', dateTo: '' };
  }

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo:   to.toISOString().slice(0, 10),
  };
}

// Presets per date type — This month / Last month only for transaction_created (reconciliation)
const SLIP_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'วันนี้',           value: 'TODAY' },
  { label: 'เมื่อวาน',         value: 'YESTERDAY' },
  { label: '7 วันที่ผ่านมา',  value: 'LAST_7_DAYS' },
  { label: '30 วันที่ผ่านมา', value: 'LAST_30_DAYS' },
  { label: 'กำหนดเอง',         value: 'CUSTOM' },
];

const TX_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'วันนี้',           value: 'TODAY' },
  { label: 'เมื่อวาน',         value: 'YESTERDAY' },
  { label: '7 วันที่ผ่านมา',  value: 'LAST_7_DAYS' },
  { label: '30 วันที่ผ่านมา', value: 'LAST_30_DAYS' },
  { label: 'เดือนนี้',         value: 'THIS_MONTH' },
  { label: 'เดือนที่แล้ว',     value: 'LAST_MONTH' },
  { label: 'กำหนดเอง',         value: 'CUSTOM' },
];

function detectPreset(dateFrom: string, dateTo: string, dateType: DateType): DatePreset {
  if (!dateFrom && !dateTo) return 'CUSTOM';
  const presets = dateType === 'slip_submitted' ? SLIP_PRESETS : TX_PRESETS;
  for (const { value } of presets) {
    if (value === 'CUSTOM') continue;
    const calc = calcPreset(value);
    if (calc.dateFrom === dateFrom && calc.dateTo === dateTo) return value;
  }
  return 'CUSTOM';
}

export default function FilterPanel({ filters, onFiltersChange, onClear, stores, activeTab }: Props) {
  // Adaptive visibility per tab (PAT-2039 Filter Panel spec)
  const showPaymentMethod = activeTab !== 'PENDING';
  const showDateTypeRadio  = activeTab !== 'PENDING'; // PENDING: always transaction_created, no radio

  const presets     = filters.dateType === 'slip_submitted' ? SLIP_PRESETS : TX_PRESETS;
  const activePreset = detectPreset(filters.dateFrom, filters.dateTo, filters.dateType);
  const isCustom    = activePreset === 'CUSTOM';

  const toggleChannel = (ch: PaymentChannel) => {
    const next = filters.paymentChannels.includes(ch)
      ? filters.paymentChannels.filter(c => c !== ch)
      : [...filters.paymentChannels, ch];
    onFiltersChange({ ...filters, paymentChannels: next });
  };

  const setDateType = (type: DateType) => {
    // Switching date type resets the picker (per card spec)
    onFiltersChange({ ...filters, dateType: type, dateFrom: '', dateTo: '' });
  };

  const applyPreset = (preset: DatePreset) => {
    if (preset === 'CUSTOM') {
      onFiltersChange({ ...filters, dateFrom: '', dateTo: '' });
      return;
    }
    const { dateFrom, dateTo } = calcPreset(preset);
    onFiltersChange({ ...filters, dateFrom, dateTo });
  };

  return (
    <div className="filter-panel">

      {/* ── Payment Method — hidden for รอชำระ tab ─────────────────────────── */}
      {showPaymentMethod && (
        <div className="filter-group">
          <span className="filter-label">วิธีชำระเงิน</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHANNELS.map(({ value, label }) => (
              <label key={value} className="filter-checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.paymentChannels.includes(value)}
                  onChange={() => toggleChannel(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Date filter ─────────────────────────────────────────────────────── */}
      <div className="filter-group">
        {showDateTypeRadio ? (
          <>
            <span className="filter-label">วันที่</span>
            <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
              {([
                { value: 'slip_submitted',     label: 'วันที่ส่ง Slip' },
                { value: 'transaction_created', label: 'วันที่สร้าง Transaction' },
              ] as { value: DateType; label: string }[]).map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 17 }}>
                  <input
                    type="radio"
                    name="dateType"
                    value={opt.value}
                    checked={filters.dateType === opt.value}
                    onChange={() => setDateType(opt.value)}
                    style={{ accentColor: 'var(--brand)', cursor: 'pointer' }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <span className="filter-label">วันที่สร้าง Transaction</span>
        )}

        {/* Preset chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: isCustom ? 8 : 0 }}>
          {presets.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => applyPreset(value)}
              style={{
                padding: '4px 12px',
                border: `1px solid ${activePreset === value ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 20,
                background: activePreset === value ? 'var(--brand-light)' : 'var(--bg-primary)',
                color: activePreset === value ? 'var(--brand)' : 'var(--text-secondary)',
                fontSize: 16,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: activePreset === value ? 600 : 400,
                transition: 'all .12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date inputs — only when "กำหนดเอง" is active */}
        {isCustom && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date" className="filter-input" style={{ flex: 1 }}
              value={filters.dateFrom}
              onChange={e => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: 16 }}>–</span>
            <input
              type="date" className="filter-input" style={{ flex: 1 }}
              value={filters.dateTo}
              onChange={e => onFiltersChange({ ...filters, dateTo: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* ── Amount range ────────────────────────────────────────────────────── */}
      <div className="filter-group">
        <span className="filter-label">ยอดเงิน (THB)</span>
        <div className="amount-range">
          <input type="number" className="filter-input" placeholder="ต่ำสุด" min={0}
            value={filters.amountMin}
            onChange={e => onFiltersChange({ ...filters, amountMin: e.target.value })} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 16 }}>–</span>
          <input type="number" className="filter-input" placeholder="สูงสุด" min={0}
            value={filters.amountMax}
            onChange={e => onFiltersChange({ ...filters, amountMax: e.target.value })} />
        </div>
      </div>

      {/* ── Store (multi-select) ────────────────────────────────────────────── */}
      <div className="filter-group">
        <span className="filter-label">ร้านค้า</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stores.map(s => (
            <label key={s.id} className="filter-checkbox-item">
              <input
                type="checkbox"
                checked={filters.storeIds.includes(s.id)}
                onChange={() => {
                  const next = filters.storeIds.includes(s.id)
                    ? filters.storeIds.filter(id => id !== s.id)
                    : [...filters.storeIds, s.id];
                  onFiltersChange({ ...filters, storeIds: next });
                }}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-panel-footer">
        <button className="btn-outline" onClick={onClear}>ล้างตัวกรอง</button>
      </div>
    </div>
  );
}
