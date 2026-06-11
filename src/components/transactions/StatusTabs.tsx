'use client';

import type { TabKey, Transaction } from '@/lib/types';

interface Props {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  transactions: Transaction[];
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ALL',          label: 'ทั้งหมด' },
  { key: 'PENDING',      label: 'รอชำระ' },
  { key: 'UNDER_REVIEW', label: 'รอตรวจสอบ' },
  { key: 'COMPLETED',    label: 'สำเร็จ' },
  { key: 'CANCELLED',    label: 'ยกเลิก' },
  { key: 'OVERPAY',      label: 'คืนเงิน' },
];

function countForTab(txns: Transaction[], tab: TabKey): number | null {
  if (tab === 'ALL') return null;
  const n = txns.filter(tx => {
    if (tab === 'PENDING')      return tx.payment_status === 'PENDING' && tx.transaction_status === 'PENDING';
    if (tab === 'UNDER_REVIEW') return tx.payment_status === 'UNDER_REVIEW';
    if (tab === 'COMPLETED')    return tx.transaction_status === 'COMPLETED' || tx.transaction_status === 'CLOSED';
    // OMS-cancelled (has cancellation_reason) goes to CANCELLED tab even if REFUND_PENDING
    if (tab === 'CANCELLED')    return tx.transaction_status === 'CANCELLED' && (tx.payment_status !== 'REFUND_PENDING' || !!tx.cancellation_reason) || tx.transaction_status === 'FAILED' || tx.transaction_status === 'EXPIRED';
    if (tab === 'OVERPAY')      return ((tx.overpay_delta ?? 0) > 0 && !tx.overpay_acknowledged && tx.payment_status === 'COMPLETED') || (tx.transaction_status === 'CANCELLED' && tx.payment_status === 'REFUND_PENDING' && !tx.cancellation_reason);
    return false;
  }).length;
  return n;
}

export default function StatusTabs({ activeTab, onTabChange, transactions }: Props) {
  return (
    <div className="status-tabs" role="tablist">
      {TABS.map(({ key, label }) => {
        const count = countForTab(transactions, key);
        return (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            className={`tab-btn${activeTab === key ? ' active' : ''}`}
            onClick={() => onTabChange(key)}
          >
            {label}
            {count !== null && count > 0 && (
              <span className="tab-count">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
