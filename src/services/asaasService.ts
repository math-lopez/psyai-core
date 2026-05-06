function getAsaasBase(): string {
  return process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

function getMasterKey(): string {
  const key = process.env.ASAAS_MASTER_KEY;
  if (!key) throw new Error('ASAAS_MASTER_KEY não configurada no servidor');
  return key;
}

async function asaasRequest<T = unknown>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const base = getAsaasBase();
  const res = await fetch(`${base}${path}`, {
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
    console.error(`[asaas] HTTP ${res.status} ${method} ${path} →`, JSON.stringify(data));
    throw new Error(msg);
  }

  return data as T;
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export async function createAsaasCustomer(
  customer: { name: string; email?: string; cpfCnpj?: string },
): Promise<string> {
  const data = await asaasRequest<{ id: string }>(getMasterKey(), 'POST', '/customers', {
    ...customer,
    notificationDisabled: true, // sistema próprio gerencia notificações ao paciente
  });
  return data.id;
}

export async function updateAsaasCustomer(
  customerId: string,
  fields: { cpfCnpj?: string },
): Promise<void> {
  await asaasRequest(getMasterKey(), 'PUT', `/customers/${customerId}`, {
    ...fields,
    notificationDisabled: true,
  });
}

// ── Pagamentos ────────────────────────────────────────────────────────────────

export type BillingType = 'UNDEFINED' | 'PIX' | 'BOLETO';

export interface AsaasPaymentResult {
  id: string;
  status: string;
  invoiceUrl: string;
}

export async function createAsaasPayment(payment: {
  customer: string;
  value: number;
  dueDate: string;
  description?: string;
  billingType?: BillingType;
}): Promise<AsaasPaymentResult> {
  return asaasRequest<AsaasPaymentResult>(getMasterKey(), 'POST', '/payments', {
    customer:                   payment.customer,
    value:                      payment.value,
    dueDate:                    payment.dueDate,
    description:                payment.description,
    billingType:                payment.billingType ?? 'UNDEFINED',
    sendPaymentByPostalService: false,  // desabilita notificações do Asaas — sistema próprio envia
  });
}

export interface AsaasPixData {
  encodedImage: string; // base64 PNG do QR code
  payload: string;      // copia-e-cola
  expirationDate: string;
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixData> {
  return asaasRequest<AsaasPixData>(getMasterKey(), 'GET', `/payments/${paymentId}/pixQrCode`);
}

export async function cancelAsaasPayment(paymentId: string): Promise<void> {
  await asaasRequest(getMasterKey(), 'DELETE', `/payments/${paymentId}`);
}

// ── Transferências (repasse) ──────────────────────────────────────────────────

export interface CreateTransferInput {
  value: number;
  pixAddressKey: string;
  pixAddressKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  description?: string;
}

export async function createAsaasTransfer(
  input: CreateTransferInput,
): Promise<{ id: string; status: string }> {
  return asaasRequest(getMasterKey(), 'POST', '/transfers', input);
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
