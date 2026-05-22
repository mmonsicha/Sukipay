// Transaction states per PAT-2039
export type TransactionStatus = 'PENDING' | 'CLOSED' | 'SETTLED' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'EXPIRED';

// Payment states per PAT-2039 (COMPLETED replaces old PAID; added REJECTED/FAILED)
export type PaymentStatus = 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED' | 'REJECTED' | 'FAILED';

// Payment channels per PAT-2039 (CREDIT/COD replace old MULTI/UNSPECIFIED)
export type PaymentChannel = 'BANK_TRANSFER' | 'CASH' | 'CREDIT' | 'COD';

export type TabKey = 'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED' | 'CANCELLED';
export type SortDirection = 'asc' | 'desc';

// Date filter type — which date field to filter on
export type DateType = 'slip_submitted' | 'transaction_created';

export interface Slip {
  slip_id: string;
  image_url: string;         // full-size image URL (mock: picsum)
  uploaded_at: string;       // ISO — วันที่อัปโหลดสลิป
  amount: number;
  transfer_time?: string;    // วันที่ชำระเงิน (from sender)
  bank_name?: string;        // ธนาคารที่รับเงิน (recipient bank)
  account_number?: string;   // เลขที่บัญชีที่รับเงิน
}

export interface Payment {
  payment_id: string;
  seq: number;               // 1-based sequence (รายการที่ N)
  payment_channel: PaymentChannel;
  bank_name?: string;
  transfer_time?: string;
  amount: number;
  payment_status: PaymentStatus;
  slip_count: number;
  slips?: Slip[];            // actual slip images (BANK_TRANSFER / CREDIT only)
}

export interface Transaction {
  transaction_id: string;
  transaction_no: string;   // TXN-YYYYMMDD-XXXXXX
  order_no: string;         // SO-XXXXXXXXXX
  store_name: string;
  store_id: string;
  payment_channel: PaymentChannel;
  bank_name?: string;
  transfer_time?: string;   // payment.created_at proxy — when slip was submitted
  amount: number;
  discount_amount?: number;
  currency: string;
  slip_count: number;
  slips?: Slip[];            // for non-expandable transactions
  payment_status: PaymentStatus;
  transaction_status: TransactionStatus;
  created_at: string;
  updated_at: string;
  is_expandable: boolean;
  payments?: Payment[];
}

export interface Store {
  id: string;
  name: string;
}

export interface FilterState {
  search: string;           // Transaction No or Order No (partial match)
  dateType: DateType;       // which date field to apply the date range to
  dateFrom: string;
  dateTo: string;
  paymentChannels: PaymentChannel[];
  amountMin: string;
  amountMax: string;
  storeIds: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  dateType: 'transaction_created',
  dateFrom: '',
  dateTo: '',
  paymentChannels: [],
  amountMin: '',
  amountMax: '',
  storeIds: [],
};
