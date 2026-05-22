'use client';

interface Props {
  hasFilters: boolean;
  onClearFilters: () => void;
}

export default function EmptyState({ hasFilters, onClearFilters }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon">🔍</div>
      <p className="empty-title">ไม่พบรายการ</p>
      <p className="empty-sub">
        {hasFilters
          ? 'ไม่มีรายการที่ตรงกับเงื่อนไขที่เลือก ลองปรับตัวกรองหรือล้างการค้นหา'
          : 'ยังไม่มีรายการธุรกรรมในระบบ'}
      </p>
      {hasFilters && (
        <button className="btn-clear" onClick={onClearFilters}>
          ล้าง filter
        </button>
      )}
    </div>
  );
}
