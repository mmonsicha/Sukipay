// Transaction states per PAT-2039
export type TransactionStatus = 'PENDING' | 'CLOSED' | 'SETTLED' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'EXPIRED';

// Payment states per PAT-2039 (VOIDED / REFUNDED added for PAT-2040)
export type PaymentStatus = 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED' | 'REJECTED' | 'FAILED' | 'VOIDED' | 'REFUNDED';

// Payment channels per PAT-2039 (CREDIT/COD replace old MULTI/UNSPECIFIED)
export type PaymentChannel = 'BANK_TRANSFER' | 'CASH' | 'CREDIT' | 'COD';

export type TabKey = 'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED' | 'CANCELLED';
export type SortDirection = 'asc' | 'desc';

// Date filter type — which date field to filter on
export type DateType = 'slip_submitted' | 'transaction_created';

// Audit trail event types per PAT-2040 / PAT-2286
export type EventType =
  | 'PAYMENT_ADDED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_DETAIL_EDITED'
  | 'PAYMENT_REFUNDED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_CLOSED'
  | 'TRANSACTION_SETTLED'
  | 'TRANSACTION_AMOUNT_UPDATED'
  | 'TRANSACTION_CANCELLED'
  | 'TRANSACTION_EXPIRED'
  | 'VOID_PREPARED'
  | 'TRANSACTION_VOIDED';

export type RejectReason =
  | 'AMOUNT_MISMATCH'
  | 'WRONG_ACCOUNT'
  | 'BLURRY_SLIP'
  | 'DUPLICATE_SLIP'
  | 'WRONG_DATE'
  | 'OTHER';

export interface Customer {
  name: string;
  contact: string;
  company_name: string;
}

export interface StateHistoryEntry {
  from_state: TransactionStatus | null;
  to_state: TransactionStatus;
  at: string;
  by?: string;
}

export interface AuditTrailEntry {
  id: string;
  transaction_id: string;
  payment_id?: string;
  event_type: EventType;
  operator_type: 'user' | 'system';
  operator_name?: string;
  operator_role?: string;
  metadata?: { reject_reason?: RejectReason };
  created_at: string;
}

export interface Slip {
  slip_id: string;
  image_url: string;         // full-size image URL (mock: picsum)
  uploaded_at: string;       // ISO — วันที่อัปโหลดสลิป
  amount: number;
  transfer_time?: string;    // วันที่ชำระเงิน (from sender)
  bank_name?: string;        // ธนาคารที่รับเงิน (recipient bank)
  account_number?: string;   // เลขที่บัญชีที่รับเงิน
  account_holder?: string;   // ชื่อเจ้าของบัญชี
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
  slip_id?: string;          // primary slip ID for slip panel
  account_holder?: string;   // account holder name for slip panel
}

export interface Transaction {
  transaction_id: string;
  transaction_no: string;   // TXN-YYYYMMDD-XXXXXX
  order_no: string;         // SO-XXXXXXXXXX
  order_serial?: string;    // formatted order serial e.g. SC-202603-00001
  order_total?: number;     // order total (may differ from tx amount)
  customer?: Customer;
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
  state_history?: StateHistoryEntry[];
  audit_trail?: AuditTrailEntry[];
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
