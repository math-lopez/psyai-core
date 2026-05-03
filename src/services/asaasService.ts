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

  const data = await res.json() as any;

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
  return asaasRequest<AsaasPaymentResult>(apiKey, 'POST', '/payments', {
    customer:    payment.customer,
    value:       payment.value,
    dueDate:     payment.dueDate,
    description: payment.description,
    billingType: payment.billingType ?? 'UNDEFINED',
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
