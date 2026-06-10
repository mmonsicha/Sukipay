'use client';

interface OverpayBannerProps {
  overpayDelta: number;
  paidAmount: number;
  orderTotal: number;
  totalRefunded?: number;
  decision: 'pending' | 'refund_pending' | 'acknowledged';
  onClickRefund: () => void;
  onClickTip: () => void;
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function OverpayBanner({
  overpayDelta,
  paidAmount,
  orderTotal,
  totalRefunded = 0,
  decision,
  onClickRefund,
  onClickTip,
}: OverpayBannerProps) {
  if (decision === 'acknowledged') return null;

  const remainingToRefund = Math.max(0, overpayDelta - totalRefunded);
  const hasPartialRefund = totalRefunded > 0 && remainingToRefund > 0;

  if (decision === 'refund_pending') {
    return (
      <div className="overpay-banner overpay-banner--pending-refund" role="status">
        <div className="overpay-banner-icon overpay-banner-icon--success">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="overpay-banner-body">
          <div className="overpay-banner-title overpay-banner-title--success">
            คืนเงินครบแล้ว
          </div>
          <div className="overpay-banner-subtitle">
            โอนคืน ฿{formatAmount(overpayDelta)} ให้ลูกค้าเรียบร้อย
          </div>
        </div>
      </div>
    );
  }

  // decision === 'pending'
  return (
    <div className="overpay-banner overpay-banner--warning" role="alert">
      <div className="overpay-banner-icon overpay-banner-icon--warning">
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div className="overpay-banner-body">
        <div className="overpay-banner-title">
          {hasPartialRefund
            ? `คืนเงินบางส่วนแล้ว — คงเหลือ +฿${formatAmount(remainingToRefund)}`
            : `พบยอดชำระเกิน +฿${formatAmount(overpayDelta)}`}
        </div>
        <div className="overpay-banner-subtitle">
          {hasPartialRefund
            ? `คืนแล้ว ฿${formatAmount(totalRefunded)} / ยอดเกินทั้งหมด ฿${formatAmount(overpayDelta)}`
            : `ลูกค้าชำระ ฿${formatAmount(paidAmount)} / ยอดสินค้า ฿${formatAmount(orderTotal)}`}
        </div>
      </div>
      <div className="overpay-banner-actions">
        <button
          className="overpay-btn overpay-btn--refund"
          onClick={onClickRefund}
          type="button"
        >
          คืนเงิน ฿{formatAmount(remainingToRefund)}
        </button>
        {!hasPartialRefund && (
          <button
            className="overpay-btn overpay-btn--tip"
            onClick={onClickTip}
            type="button"
          >
            ถือเป็น Tip
          </button>
        )}
      </div>
    </div>
  );
}
