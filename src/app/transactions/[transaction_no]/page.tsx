import dynamic from 'next/dynamic';

const TransactionDetailPage = dynamic(
  () => import('@/components/transactions/TransactionDetailPage'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 18 }}>กำลังโหลด...</div> }
);

export default function Page() {
  return <TransactionDetailPage />;
}
