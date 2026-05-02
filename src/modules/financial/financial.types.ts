export const CHARGE_STATUS = ["pending", "paid", "overdue", "cancelled"] as const;
export const PIX_KEY_TYPES = ["cpf", "email", "phone", "random"] as const;

export type ChargeStatus = (typeof CHARGE_STATUS)[number];
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export interface FinancialSettings {
  id: string;
  psychologist_id: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  beneficiary_name: string;
  default_session_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialCharge {
  id: string;
  psychologist_id: string;
  patient_id: string;
  session_id: string | null;
  amount: number;
  description: string | null;
  due_date: string | null;
  status: ChargeStatus;
  paid_at: string | null;
  notes: string | null;
  asaas_payment_id: string | null;
  created_at: string;
  updated_at: string;
  patient?: { id: string; full_name: string };
}

export interface UnbilledSession {
  id: string;
  session_date: string;
  session_summary_manual: string | null;
  manual_notes: string | null;
}

export interface FinancialSummary {
  received: number;
  pending: number;
  overdue: number;
  total_charges: number;
}
