import dynamic from 'next/dynamic';

const TransactionPage = dynamic(
  () => import('@/components/transactions/TransactionPage'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>กำลังโหลด...</div> }
);

export default function TransactionsPage() {
  return <TransactionPage />;
}
