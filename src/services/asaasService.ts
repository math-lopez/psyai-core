const ASAAS_BASE = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

async function asaasRequest<T = unknown>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `Asaas error ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

// ── Conta ────────────────────────────────────────────────────────────────────

export async function validateAsaasKey(apiKey: string): Promise<{ name: string; email: string }> {
  const data = await asaasRequest<any>(apiKey, 'GET', '/myAccount');
  return { name: data.name, email: data.email };
}

export interface CreateSubAccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string; // YYYY-MM-DD — obrigatório para pessoa física
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';
}

export async function createSubAccount(input: CreateSubAccountInput): Promise<{ apiKey: string; id: string }> {
  const masterKey = process.env.ASAAS_MASTER_KEY;
  if (!masterKey) throw new Error('ASAAS_MASTER_KEY não configurada no servidor');

  const data = await asaasRequest<any>(masterKey, 'POST', '/accounts', input);

  if (!data.apiKey) throw new Error('Asaas não retornou a API key da sub-conta');

  return { apiKey: data.apiKey, id: data.id };
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export async function createAsaasCustomer(
  apiKey: string,
  customer: { name: string; email?: string; cpfCnpj?: string },
): Promise<string> {
  const data = await asaasRequest<{ id: string }>(apiKey, 'POST', '/customers', customer);
  return data.id;
}

export async function updateAsaasCustomer(
  apiKey: string,
  customerId: string,
  fields: { cpfCnpj?: string },
): Promise<void> {
  await asaasRequest(apiKey, 'PUT', `/customers/${customerId}`, fields);
}

// ── Pagamentos ────────────────────────────────────────────────────────────────

export type BillingType = 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';

export interface AsaasPaymentResult {
  id: string;
  status: string;
  invoiceUrl: string;
}

export async function createAsaasPayment(
  apiKey: string,
  payment: {
    customer: string;
    value: number;
    dueDate: string;
    description?: string;
    billingType?: BillingType;
  },
): Promise<AsaasPaymentResult> {
  const walletId    = process.env.ASAAS_WALLET_ID;
  const feePercent  = Number(process.env.PLATFORM_FEE_PERCENT ?? 3);
  const split       = walletId && feePercent > 0
    ? [{ walletId, percentualValue: feePercent }]
    : undefined;

  return asaasRequest<AsaasPaymentResult>(apiKey, 'POST', '/payments', {
    customer:    payment.customer,
    value:       payment.value,
    dueDate:     payment.dueDate,
    description: payment.description,
    billingType: payment.billingType ?? 'UNDEFINED',
    ...(split ? { split } : {}),
  });
}

export interface AsaasPixData {
  encodedImage: string; // base64 PNG do QR code
  payload: string;      // copia-e-cola
  expirationDate: string;
}

export async function getAsaasPixQrCode(apiKey: string, paymentId: string): Promise<AsaasPixData> {
  return asaasRequest<AsaasPixData>(apiKey, 'GET', `/payments/${paymentId}/pixQrCode`);
}

export async function cancelAsaasPayment(apiKey: string, paymentId: string): Promise<void> {
  await asaasRequest(apiKey, 'DELETE', `/payments/${paymentId}`);
}

// ── Carteira / Wallet ─────────────────────────────────────────────────────────

export interface AsaasBalance {
  balance: number;
  totalBalance: number;
}

export interface AsaasStatementEntry {
  id: string;
  date: string;
  value: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  balance: number;
}

export interface AsaasTransfer {
  id: string;
  dateCreated: string;
  value: number;
  type: string;
  status: string;
  description: string | null;
  pixAddressKey?: string;
}

export interface CreateTransferInput {
  value: number;
  pixAddressKey: string;
  pixAddressKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  description?: string;
}

export async function getAsaasBalance(apiKey: string): Promise<AsaasBalance> {
  return asaasRequest<AsaasBalance>(apiKey, 'GET', '/finance/balance');
}

export async function getAsaasStatement(
  apiKey: string,
  params?: { startDate?: string; endDate?: string; limit?: number; offset?: number },
): Promise<{ data: AsaasStatementEntry[]; totalCount: number; hasMore: boolean }> {
  const qs = new URLSearchParams();
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate)   qs.set('endDate', params.endDate);
  if (params?.limit)     qs.set('limit', String(params.limit));
  if (params?.offset)    qs.set('offset', String(params.offset));
  const q = qs.toString();
  const res = await asaasRequest<any>(apiKey, 'GET', `/finance/financialStatement${q ? '?' + q : ''}`);
  return { data: res?.data ?? [], totalCount: res?.totalCount ?? 0, hasMore: res?.hasMore ?? false };
}

export async function getAsaasTransfers(
  apiKey: string,
  params?: { limit?: number; offset?: number },
): Promise<{ data: AsaasTransfer[]; totalCount: number; hasMore: boolean }> {
  const qs = new URLSearchParams();
  if (params?.limit)  qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const q = qs.toString();
  const res = await asaasRequest<any>(apiKey, 'GET', `/transfers${q ? '?' + q : ''}`);
  return { data: res?.data ?? [], totalCount: res?.totalCount ?? 0, hasMore: res?.hasMore ?? false };
}

export async function createAsaasTransfer(
  apiKey: string,
  input: CreateTransferInput,
): Promise<{ id: string; status: string }> {
  return asaasRequest(apiKey, 'POST', '/transfers', input);
}

// ─────────────────────────────────────────────────────────────────────────────

export function asaasStatusToInternal(asaasStatus: string): string {
  const map: Record<string, string> = {
    PENDING:          'pending',
    RECEIVED:         'paid',
    CONFIRMED:        'paid',
    OVERDUE:          'overdue',
    REFUNDED:         'cancelled',
    REFUND_REQUESTED: 'cancelled',
    CANCELLED:        'cancelled',
    DELETED:          'cancelled',
  };
  return map[asaasStatus] ?? 'pending';
}
