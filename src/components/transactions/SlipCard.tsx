'use client';

import React from 'react';
import type { Slip } from '@/lib/types';

// ── Bank brand config ─────────────────────────────────────────────────────────
const BANK_CFG: Record<string, { bg: string; stripe: string; fg: string; short: string; logo: string }> = {
  'ธนาคารกสิกรไทย':       { bg: '#00A651', stripe: '#007a3c', fg: '#fff', short: 'KBANK', logo: 'K' },
  'ธนาคารไทยพาณิชย์':     { bg: '#4B2E83', stripe: '#3a2066', fg: '#fff', short: 'SCB',   logo: 'S' },
  'ธนาคารกรุงเทพ':         { bg: '#1B3F8B', stripe: '#12306e', fg: '#fff', short: 'BBL',   logo: 'B' },
  'ธนาคารกรุงไทย':         { bg: '#007DB7', stripe: '#005f8c', fg: '#fff', short: 'KTB',   logo: 'K' },
  'ธนาคารกรุงศรีอยุธยา':  { bg: '#F7A600', stripe: '#c97f00', fg: '#fff', short: 'BAY',   logo: 'A' },
  'ธนาคารทหารไทยธนชาต':   { bg: '#F47920', stripe: '#c25500', fg: '#fff', short: 'TTB',   logo: 'T' },
  'ธนาคารออมสิน':          { bg: '#4DB036', stripe: '#388024', fg: '#fff', short: 'GSB',   logo: 'G' },
  'ธนาคารอาคารสงเคราะห์': { bg: '#F05A28', stripe: '#bf3e13', fg: '#fff', short: 'GHB',   logo: 'H' },
};
const DEFAULT_CFG = { bg: '#32a9ff', stripe: '#1a8de0', fg: '#fff', short: 'BANK', logo: 'B' };

function bankCfg(name?: string | null) {
  return (name ? BANK_CFG[name] : undefined) ?? DEFAULT_CFG;
}

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Bangkok',
  }).format(new Date(iso)).replace(',', '');
}

function maskAcct(s: string) {
  if (s.length <= 4) return s;
  return s.slice(0, 3) + 'x'.repeat(s.length - 7) + s.slice(-4);
}

// ── Deterministic pseudo-QR (21×21) ─────────────────────────────────────────
function PseudoQR({ seed, size = 21 }: { seed: string; size?: number }) {
  const N = 21;
  const C = size;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h, 31) + seed.charCodeAt(i) | 0;

  function isFinderPattern(r: number, c: number) {
    const tl = r < 7 && c < 7;
    const tr = r < 7 && c >= N - 7;
    const bl = r >= N - 7 && c < 7;
    if (!tl && !tr && !bl) return null;
    const lr = tl ? r : bl ? r - (N - 7) : r;
    const lc = tl ? c : tr ? c - (N - 7) : c;
    if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
    if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
    return false;
  }

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const finder = isFinderPattern(r, c);
      let filled: boolean;
      if (finder !== null) {
        filled = finder;
      } else if (r === 6 || c === 6) {
        filled = (r + c) % 2 === 0;
      } else {
        h = Math.imul(h, 1664525) + 1013904223 | 0;
        filled = (h >>> 0) % 3 !== 0;
      }
      if (filled) cells.push(<rect key={`${r}-${c}`} x={c * C} y={r * C} width={C} height={C} fill="#1a1a1a" />);
    }
  }

  const px = N * C;
  const pad = C * 2;
  return (
    <svg width={px + pad * 2} height={px + pad * 2} viewBox={`0 0 ${px + pad * 2} ${px + pad * 2}`}>
      <rect width={px + pad * 2} height={px + pad * 2} fill="#fff" />
      <g transform={`translate(${pad},${pad})`}>{cells}</g>
    </svg>
  );
}

// ── Barcode ───────────────────────────────────────────────────────────────────
function Barcode({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = Math.imul(h, 31) + ch.charCodeAt(0) | 0;
  const bars = Array.from({ length: 52 }, (_, i) => {
    h = Math.imul(h, 1664525) + 1013904223 | 0;
    return { w: (Math.abs(h) % 3) + 1, filled: i % 2 === 0 };
  });
  const totalW = bars.reduce((s, b) => s + b.w + 1, 0);
  return (
    <svg width={totalW} height={28} viewBox={`0 0 ${totalW} 28`}>
      {bars.reduce<{ x: number; nodes: React.ReactNode[] }>(
        ({ x, nodes }, b, i) => ({
          x: x + b.w + 1,
          nodes: [...nodes, b.filled
            ? <rect key={i} x={x} y={0} width={b.w} height={28} fill="#1a1a1a" />
            : null],
        }),
        { x: 0, nodes: [] },
      ).nodes}
    </svg>
  );
}

// ── Perforation separator ─────────────────────────────────────────────────────
function Perforator() {
  return (
    <div className="slipcard-perf">
      <div className="slipcard-perf-notch" />
      <div className="slipcard-perf-line" />
      <div className="slipcard-perf-notch" />
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="slipcard-row">
      <span className="slipcard-row-k">{label}</span>
      <span className={`slipcard-row-v${mono ? ' slipcard-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Main SlipCard ─────────────────────────────────────────────────────────────
interface Props {
  slip: Slip;
  overrideBankName?: string | null;
}

export default function SlipCard({ slip, overrideBankName }: Props) {
  const bankName = overrideBankName ?? slip.bank_name ?? null;
  const cfg = bankCfg(bankName);
  const shortRef = slip.slip_id.slice(-16).toUpperCase();

  return (
    <div className="slipcard">

      {/* ── Bank header ── */}
      <div className="slipcard-header" style={{ background: cfg.bg }}>
        <div className="slipcard-logo-badge" style={{ color: cfg.bg }}>
          {cfg.logo}
        </div>
        <div className="slipcard-header-text">
          <span className="slipcard-bank-short" style={{ color: cfg.fg }}>{cfg.short}</span>
          <span className="slipcard-bank-name" style={{ color: `${cfg.fg}cc` }}>{bankName ?? 'ธนาคาร'}</span>
        </div>
        <div className="slipcard-header-tag" style={{ borderColor: `${cfg.fg}55`, color: cfg.fg }}>
          PromptPay
        </div>
      </div>

      {/* ── Success section ── */}
      <div className="slipcard-success-section">
        <div className="slipcard-check-outer">
          <div className="slipcard-check-inner">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <span className="slipcard-success-label">โอนสำเร็จ</span>
        <span className="slipcard-amount-label">จำนวนเงิน (บาท)</span>
        <span className="slipcard-amount-value">฿ {fmt(slip.amount)}</span>
        {slip.transfer_time && (
          <span className="slipcard-transfer-time">{fmtDate(slip.transfer_time)}</span>
        )}
      </div>

      {/* ── Perforation ── */}
      <Perforator />

      {/* ── Transfer details ── */}
      <div className="slipcard-details">
        {bankName && <Row label="ธนาคาร" value={bankName} />}
        {slip.account_number && (
          <Row label="บัญชีผู้รับ" value={maskAcct(slip.account_number)} mono />
        )}
        {slip.account_holder && <Row label="ชื่อผู้รับ" value={slip.account_holder} />}
        <Row label="อัปโหลด" value={fmtDate(slip.uploaded_at)} />
        <Row label="เลขอ้างอิง" value={shortRef} mono />
      </div>

      {/* ── Perforation ── */}
      <Perforator />

      {/* ── QR + Barcode footer ── */}
      <div className="slipcard-qr-section">
        <div className="slipcard-qr-wrap">
          <PseudoQR seed={slip.slip_id} size={3} />
        </div>
        <div className="slipcard-qr-meta">
          <span className="slipcard-qr-label">สแกนเพื่อตรวจสอบ</span>
          <div className="slipcard-barcode-wrap">
            <Barcode seed={slip.slip_id} />
          </div>
          <span className="slipcard-barcode-id">{shortRef.slice(0, 8)}</span>
        </div>
      </div>

    </div>
  );
}
