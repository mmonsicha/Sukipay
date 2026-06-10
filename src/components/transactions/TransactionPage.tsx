'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Transaction, TabKey, FilterState, TransactionStatus, PaymentStatus, SortDirection } from '@/lib/types';
import { DEFAULT_FILTERS } from '@/lib/types';
import { INITIAL_TRANSACTIONS, STORES_LIST, generateTransaction } from '@/lib/mockData';
import TopNavbar from '@/components/layout/TopNavbar';
import Sidebar from '@/components/layout/Sidebar';
import StatusTabs from './StatusTabs';
import SearchFilterBar from './SearchFilterBar';
import FilterModal from './FilterModal';
import TransactionTable from './TransactionTable';
import NewTransactionsBanner from './NewTransactionsBanner';
import EmptyState from './EmptyState';
import SubmitPaymentModal, { type SubmitPaymentResult } from './SubmitPaymentModal';

const POLL_INTERVAL_MS = 8_000; // 8s for prototype demo (production: 30_000)
const ROWS_OPTIONS = [10, 50, 100, 200];

// ── Tab matching — per PAT-2039 spec ─────────────────────────────────────────
// รอชำระ:     tx=PENDING  + pay=PENDING/REJECTED/FAILED
// รอตรวจสอบ: tx=PENDING  + pay=UNDER_REVIEW
// สำเร็จ:     tx=CLOSED/SETTLED + pay=COMPLETED
// ยกเลิก:     tx=CANCELLED (any payment)

function matchesTab(tx: Transaction, tab: TabKey): boolean {
  switch (tab) {
    case 'ALL':
      return true;
    case 'PENDING':
      return tx.transaction_status === 'PENDING' &&
        (tx.payment_status === 'PENDING' || tx.payment_status === 'REJECTED' || tx.payment_status === 'FAILED');
    case 'UNDER_REVIEW':
      return tx.transaction_status === 'PENDING' && tx.payment_status === 'UNDER_REVIEW';
    case 'COMPLETED':
      return (tx.transaction_status === 'CLOSED' || tx.transaction_status === 'SETTLED') &&
        tx.payment_status === 'COMPLETED';
    case 'CANCELLED':
      // CANCELLED แต่ REFUND_PENDING → แสดงใน Tab คืนเงินแทน
      return tx.transaction_status === 'CANCELLED' && tx.payment_status !== 'REFUND_PENDING';
    case 'OVERPAY':
      // PAT-2036: overpay รอ Finance ตัดสินใจ
      if ((tx.overpay_delta ?? 0) > 0 && !tx.overpay_acknowledged && tx.payment_status === 'COMPLETED') return true;
      // PAT-2036: CANCELLED + REFUND_PENDING — order ถูกยกเลิก แต่ลูกค้าโอนเงินมาแล้ว รอ Finance คืนเงิน
      if (tx.transaction_status === 'CANCELLED' && tx.payment_status === 'REFUND_PENDING') return true;
      return false;
    default:
      return true;
  }
}

// ── Filter matching ───────────────────────────────────────────────────────────

function matchesFilters(tx: Transaction, f: FilterState): boolean {
  if (f.search) {
    const q = f.search.toUpperCase();
    if (!tx.transaction_no.includes(q) && !tx.order_no.toUpperCase().includes(q)) return false;
  }
  if (f.paymentChannels.length > 0 && !f.paymentChannels.includes(tx.payment_channel)) return false;
  if (f.amountMin && parseFloat(f.amountMin) > tx.amount) return false;
  if (f.amountMax && parseFloat(f.amountMax) < tx.amount) return false;
  if (f.storeIds.length > 0 && !f.storeIds.includes(tx.store_id)) return false;

  // Date filter — field depends on dateType (per PAT-2039 date filter design)
  if (f.dateFrom || f.dateTo) {
    const dateVal = f.dateType === 'slip_submitted' ? tx.transfer_time : tx.created_at;
    if (f.dateType === 'slip_submitted' && !tx.transfer_time) return false;
    if (dateVal) {
      if (f.dateFrom && new Date(dateVal) < new Date(f.dateFrom)) return false;
      if (f.dateTo) {
        const to = new Date(f.dateTo);
        to.setHours(23, 59, 59);
        if (new Date(dateVal) > to) return false;
      }
    }
  }

  return true;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransactionPage() {
  useEffect(() => { import('@uxuissk/design-system-core').catch(() => {}); }, []);

  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [pendingNew, setPendingNew] = useState<Transaction[]>([]);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [pollCount, setPollCount] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [gotoPage, setGotoPage] = useState('');

  // PAT-2044: Submit Payment modal
  const [payingTx, setPayingTx] = useState<Transaction | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Visibility + scroll
  useEffect(() => {
    const onVis = () => setIsTabVisible(!document.hidden);
    const onScroll = () => setIsAtTop(window.scrollY < 60);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const list = transactions
      .filter(tx => matchesTab(tx, activeTab))
      .filter(tx => matchesFilters(tx, filters));
    list.sort((a, b) => {
      const av = a[sortField as keyof Transaction] as string | number ?? '';
      const bv = b[sortField as keyof Transaction] as string | number ?? '';
      const m = sortDir === 'asc' ? 1 : -1;
      return av < bv ? -m : av > bv ? m : 0;
    });
    return list;
  }, [transactions, activeTab, filters, sortField, sortDir]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * rowsPerPage;
  const pageItems = filtered.slice(pageStart, pageStart + rowsPerPage);

  // Active filter count — modal-managed filters only (date is separate in toolbar)
  const activeFilterCount = useMemo(() => [
    filters.paymentChannels.length > 0,
    !!(filters.amountMin || filters.amountMax),
    filters.storeIds.length > 0,
  ].filter(Boolean).length, [filters]);

  const hasAnyFilter = activeFilterCount > 0 || !!filters.search || activeTab !== 'ALL';

  // ── Polling ───────────────────────────────────────────────────────────────

  const flashRows = useCallback((ids: string[]) => {
    setNewRowIds(new Set(ids));
    setTimeout(() => setNewRowIds(new Set()), 1500);
  }, []);

  const runPoll = useCallback(() => {
    setPollCount(c => c + 1);

    // Level 1: new transactions
    if (Math.random() < 0.45) {
      const count = Math.floor(Math.random() * 3) + 1;
      const newTxns: Transaction[] = Array.from({ length: count }, () => generateTransaction(0));
      const matching = newTxns.filter(tx => matchesTab(tx, activeTab) && matchesFilters(tx, filters));

      if (matching.length > 0) {
        if (isAtTop && currentPage === 1) {
          setTransactions(prev => [...newTxns, ...prev]);
          flashRows(newTxns.map(t => t.transaction_id));
        } else {
          setPendingNew(prev => [...matching, ...prev]);
        }
      } else {
        setTransactions(prev => [...newTxns, ...prev]);
      }
    }

    // Level 2: in-place status badge updates
    if (Math.random() < 0.35) {
      const txStatuses: TransactionStatus[] = ['PENDING', 'CLOSED', 'SETTLED', 'COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED'];
      const payStatuses: PaymentStatus[] = ['PENDING', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'FAILED'];
      setTransactions(prev => {
        const updated = [...prev];
        const idx = Math.floor(Math.random() * Math.min(30, updated.length));
        if (!updated[idx]) return prev;
        updated[idx] = {
          ...updated[idx],
          transaction_status: txStatuses[Math.floor(Math.random() * txStatuses.length)],
          payment_status: payStatuses[Math.floor(Math.random() * payStatuses.length)],
          updated_at: new Date().toISOString(),
        };
        return updated;
      });
    }
  }, [isAtTop, currentPage, activeTab, filters, flashRows]);

  useEffect(() => {
    if (!isTabVisible) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      return;
    }
    pollingRef.current = setInterval(runPoll, POLL_INTERVAL_MS);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isTabVisible, runPoll]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBannerLoad = () => {
    setTransactions(prev => [...pendingNew, ...prev]);
    flashRows(pendingNew.map(t => t.transaction_id));
    setPendingNew([]);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => { setFilters(DEFAULT_FILTERS); setCurrentPage(1); };

  // PAT-2044: อัปเดต mock state หลัง payment submit สำเร็จ
  const handlePaymentSuccess = useCallback((result: SubmitPaymentResult) => {
    if (!payingTx) return;
    const { payments: newPays, completedTotal } = result;

    setTransactions(prev => prev.map(t => {
      if (t.transaction_id !== payingTx.transaction_id) return t;

      // Build updated payments list
      const existingPayments = t.payments ?? [{
        payment_id: `${t.transaction_id}-pay-1`,
        seq: 1,
        payment_channel: t.payment_channel,
        bank_name: t.bank_name,
        transfer_time: t.transfer_time,
        amount: t.amount,
        payment_status: t.payment_status,
        slip_count: t.slip_count,
        slips: t.slips,
      }];

      const addedPayments = newPays.map((p, i) => ({
        payment_id: p.id,
        seq: existingPayments.length + i + 1,
        payment_channel: (p.method === 'cash' ? 'CASH' : 'BANK_TRANSFER') as import('@/lib/types').PaymentChannel,
        bank_name: p.bankCode ? (['014','004','006','002','025'] as const).includes(p.bankCode as never)
          ? { '014': 'ธนาคารไทยพาณิชย์', '004': 'ธนาคารกสิกรไทย', '006': 'ธนาคารกรุงไทย', '002': 'ธนาคารกรุงเทพ', '025': 'ธนาคารกรุงศรีอยุธยา' }[p.bankCode]
          : undefined : undefined,
        transfer_time: p.transferredAt,
        amount: p.amount,
        payment_status: p.status,
        slip_count: p.slipPreview ? 1 : 0,
      }));

      const allPayments = [...existingPayments, ...addedPayments];

      // ถ้ายอดครบ → CLOSED + payment_status COMPLETED
      const isClosed = completedTotal >= t.amount;

      return {
        ...t,
        is_expandable: true,
        payments: allPayments,
        payment_status: isClosed ? 'COMPLETED' : (
          newPays.some(p => p.status === 'UNDER_REVIEW') ? 'UNDER_REVIEW' : t.payment_status
        ),
        transaction_status: isClosed ? 'CLOSED' : t.transaction_status,
        updated_at: new Date().toISOString(),
      };
    }));

    // ปิด modal เมื่อชำระครบ
    if (completedTotal >= payingTx.amount) {
      setPayingTx(null);
    }
  }, [payingTx]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setPendingNew([]);

    setFilters(prev => {
      let next = { ...prev };
      // รอชำระ tab: Payment Method not applicable — reset it (PAT-2039 spec)
      if (tab === 'PENDING') {
        next = { ...next, paymentChannels: [] };
      }
      // รอตรวจสอบ tab: auto-select "วันที่ส่ง Slip" date type (PAT-2039 spec)
      if (tab === 'UNDER_REVIEW' && prev.dateType !== 'slip_submitted') {
        next = { ...next, dateType: 'slip_submitted', dateFrom: '', dateTo: '' };
      }
      return next;
    });
  };

  const handleFiltersChange = (f: FilterState) => { setFilters(f); setCurrentPage(1); };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setCurrentPage(1);
  };

  const handleGoto = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const p = parseInt(gotoPage);
      if (p >= 1 && p <= totalPages) { setCurrentPage(p); setGotoPage(''); }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="sellsuki-app">
      <TopNavbar pollCount={pollCount} isPolling={isTabVisible} />

      <div className="app-body">
        <Sidebar />

        <main className="app-content">
          <h1 className="page-title">รายการธุรกรรม</h1>

          {/* Banner */}
          {pendingNew.length > 0 && (
            <NewTransactionsBanner
              count={pendingNew.length}
              onLoad={handleBannerLoad}
              onDismiss={e => { e.stopPropagation(); setPendingNew([]); }}
            />
          )}

          {/* Tabs */}
          <StatusTabs activeTab={activeTab} onTabChange={handleTabChange} transactions={transactions} />

          {/* Toolbar */}
          <SearchFilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            activeFilterCount={activeFilterCount}
            isFilterOpen={isFilterOpen}
            onToggleFilter={() => setIsFilterOpen(p => !p)}
            onClearAll={handleClearFilters}
          />

          {/* Filter Modal — right-side drawer, 2-step apply (PAT-2039 + Figma) */}
          <FilterModal
            open={isFilterOpen}
            filters={filters}
            onApply={handleFiltersChange}
            onClose={() => setIsFilterOpen(false)}
            stores={STORES_LIST}
            activeTab={activeTab}
          />

          {/* Table or empty */}
          {totalItems === 0 ? (
            <div className="table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
              <EmptyState hasFilters={hasAnyFilter} onClearFilters={handleClearFilters} />
            </div>
          ) : (
            <>
              <TransactionTable
                transactions={pageItems}
                newRows={newRowIds}
                sortField={sortField}
                sortDirection={sortDir}
                onSort={handleSort}
                onSubmitPayment={setPayingTx}
              />

              {/* Pagination */}
              <div className="pagination-bar">
                <div className="rows-per-page">
                  <span>แสดงต่อหน้า</span>
                  <select className="rows-select" value={rowsPerPage}
                    onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                    {ROWS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div className="pagination-info">
                  {pageStart + 1}–{Math.min(pageStart + rowsPerPage, totalItems)} จาก {totalItems.toLocaleString('th-TH')} รายการ
                </div>

                <div className="pagination-controls">
                  <button className="page-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(1)} title="หน้าแรก">«</button>
                  <button className="page-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)} title="ก่อนหน้า">‹</button>
                  <button className="page-btn page-btn-active">{safePage}</button>
                  <button className="page-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} title="ถัดไป">›</button>
                  <button className="page-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)} title="หน้าสุดท้าย">»</button>

                  <div className="goto-page">
                    <span>ไปที่หน้า</span>
                    <input
                      type="number" className="goto-input"
                      min={1} max={totalPages}
                      value={gotoPage}
                      onChange={e => setGotoPage(e.target.value)}
                      onKeyDown={handleGoto}
                      placeholder={String(safePage)}
                    />
                    <button
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand)', fontSize: 20, lineHeight: 1 }}
                      onClick={() => { const p = parseInt(gotoPage); if (p >= 1 && p <= totalPages) { setCurrentPage(p); setGotoPage(''); } }}
                    >→</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      {/* PAT-2044: Submit Payment modal */}
      {payingTx && (
        <SubmitPaymentModal
          open={!!payingTx}
          tx={payingTx}
          onSuccess={handlePaymentSuccess}
          onClose={() => setPayingTx(null)}
        />
      )}
    </div>
  );
}
