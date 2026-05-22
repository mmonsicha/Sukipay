'use client';

interface Props {
  count: number;
  onLoad: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}

export default function NewTransactionsBanner({ count, onLoad, onDismiss }: Props) {
  return (
    <div className="new-txn-banner" onClick={onLoad} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onLoad()}>
      <div className="banner-text">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        มี {count} รายการใหม่ — คลิกเพื่อโหลด
      </div>
      <button
        className="banner-dismiss"
        aria-label="ปิด"
        onClick={e => { e.stopPropagation(); onDismiss(e); }}
      >
        ✕
      </button>
    </div>
  );
}
