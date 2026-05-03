import { FastifyInstance } from "fastify";
import { FinancialRepository } from "./financial.repository";
import { FinancialCharge, FinancialSettings, FinancialSummary, UnbilledSession } from "./financial.types";
import { sendChargeEmail } from "../../services/emailService";
import { buildPixPayload } from "../../lib/pix";
import {
  validateAsaasKey,
  createSubAccount,
  CreateSubAccountInput,
  createAsaasCustomer,
  updateAsaasCustomer,
  createAsaasPayment,
  getAsaasPixQrCode,
  cancelAsaasPayment,
  asaasStatusToInternal,
  getAsaasBalance,
  getAsaasStatement,
  getAsaasTransfers,
  createAsaasTransfer,
  CreateTransferInput,
  BillingType,
} from "../../services/asaasService";

export class FinancialService {
  private readonly repository: FinancialRepository;

  constructor(private readonly fastify: FastifyInstance) {
    this.repository = new FinancialRepository(fastify.supabaseAdmin);
  }

  async getSettings(psychologistId: string): Promise<FinancialSettings | null> {
    return this.repository.findSettings(psychologistId);
  }

  async saveSettings(
    psychologistId: string,
    payload: Omit<FinancialSettings, "id" | "psychologist_id" | "created_at" | "updated_at">,
  ): Promise<FinancialSettings> {
    return this.repository.upsertSettings(psychologistId, payload);
  }

  async connectAsaas(psychologistId: string, input: CreateSubAccountInput): Promise<{ name: string }> {
    const subAccount = await createSubAccount(input);
    await this.repository.saveAsaasApiKey(psychologistId, subAccount.apiKey);
    return { name: input.name };
  }

  async getAsaasStatus(psychologistId: string): Promise<{ connected: boolean; name?: string }> {
    const apiKey = await this.repository.findAsaasApiKey(psychologistId);
    if (!apiKey) return { connected: false };
    try {
      const account = await validateAsaasKey(apiKey);
      return { connected: true, name: account.name };
    } catch {
      return { connected: false };
    }
  }

  async listCharges(
    psychologistId: string,
    filters: { status?: string; patientId?: string; from?: string; to?: string },
  ): Promise<FinancialCharge[]> {
    return this.repository.listCharges(psychologistId, filters);
  }

  async createCharge(
    psychologistId: string,
    payload: Pick<FinancialCharge, "patient_id" | "session_id" | "amount" | "description" | "due_date" | "notes"> & { billing_type?: BillingType },
  ): Promise<FinancialCharge & { asaas_error?: string }> {
    const asaasKey = await this.repository.findAsaasApiKey(psychologistId);
    if (asaasKey && Number(payload.amount) < 5) {
      throw this.fastify.httpErrors.badRequest('O valor mínimo para cobranças via Asaas é R$ 5,00.');
    }

    const charge = await this.repository.createCharge(psychologistId, payload);

    try {
      await this.createAsaasPaymentAsync(psychologistId, charge.id, payload);
    } catch (err: any) {
      this.fastify.log.error({ err }, '[asaas] Falha ao criar pagamento no Asaas');
      return { ...charge, asaas_error: err?.message ?? 'Erro ao criar pagamento no Asaas' };
    }

    return charge;
  }

  private async createAsaasPaymentAsync(
    psychologistId: string,
    chargeId: string,
    payload: Pick<FinancialCharge, "patient_id" | "amount" | "description" | "due_date"> & { billing_type?: BillingType },
  ) {
    const apiKey = await this.repository.findAsaasApiKey(psychologistId);
    if (!apiKey) return;

    // Busca ou cria cliente no Asaas
    const patient = await this.repository.findPatientBasic(payload.patient_id);
    if (!patient) return;

    if (!patient.cpf) {
      throw new Error('Paciente sem CPF cadastrado. Adicione o CPF do paciente antes de cobrar via Asaas.');
    }

    const cpfCnpj = patient.cpf.replace(/\D/g, '');

    let customerId = await this.repository.findPatientAsaasCustomerId(payload.patient_id);
    if (!customerId) {
      customerId = await createAsaasCustomer(apiKey, {
        name:    patient.full_name,
        email:   patient.email || undefined,
        cpfCnpj,
      });
      await this.repository.savePatientAsaasCustomerId(payload.patient_id, customerId);
    } else {
      // Garante que o cliente no Asaas tem o CPF atualizado
      await updateAsaasCustomer(apiKey, customerId, { cpfCnpj }).catch(() => {});
    }

    if (Number(payload.amount) < 5) {
      throw new Error('O valor mínimo para cobranças via Asaas é R$ 5,00.');
    }

    const dueDate = payload.due_date
      ? payload.due_date.slice(0, 10)
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const payment = await createAsaasPayment(apiKey, {
      customer:    customerId,
      value:       Number(payload.amount),
      dueDate,
      description: payload.description ?? undefined,
      billingType: payload.billing_type,
    });

    await this.repository.updateChargeAsaasPaymentId(chargeId, payment.id, payment.invoiceUrl);
  }

  async updateStatus(
    id: string,
    psychologistId: string,
    status: string,
  ): Promise<FinancialCharge> {
    const validStatuses = ["pending", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw this.fastify.httpErrors.badRequest("Status inválido");
    }

    const charge = await this.repository.findChargeById(id, psychologistId);

    // Cancela no Asaas se houver pagamento vinculado
    if (status === 'cancelled' && charge?.asaas_payment_id) {
      const apiKey = await this.repository.findAsaasApiKey(psychologistId);
      if (apiKey) {
        cancelAsaasPayment(apiKey, charge.asaas_payment_id).catch((err) => {
          this.fastify.log.warn({ err }, '[asaas] Falha ao cancelar pagamento no Asaas');
        });
      }
    }

    return this.repository.updateStatus(id, psychologistId, status);
  }

  async getUnbilledSessions(patientId: string, psychologistId: string): Promise<UnbilledSession[]> {
    return this.repository.findUnbilledSessions(patientId, psychologistId);
  }

  async closePeriod(
    psychologistId: string,
    patientId: string,
    sessionIds: string[],
    sessionValue: number,
    description: string,
    billingType?: BillingType,
  ): Promise<FinancialCharge & { asaas_error?: string }> {
    if (!sessionIds.length) throw this.fastify.httpErrors.badRequest("Selecione ao menos uma sessão");
    const amount = Number((sessionValue * sessionIds.length).toFixed(2));

    const asaasKey = await this.repository.findAsaasApiKey(psychologistId);
    if (asaasKey && amount < 5) {
      throw this.fastify.httpErrors.badRequest('O valor mínimo para cobranças via Asaas é R$ 5,00.');
    }

    const charge = await this.repository.closePeriod({ psychologistId, patientId, sessionIds, amount, description });

    try {
      await this.createAsaasPaymentAsync(psychologistId, charge.id, {
        patient_id:   charge.patient_id,
        amount:       charge.amount,
        description:  charge.description,
        due_date:     charge.due_date,
        billing_type: billingType,
      });
    } catch (err: any) {
      this.fastify.log.error({ err }, '[asaas] Falha ao criar pagamento no Asaas via closePeriod');
      return { ...charge, asaas_error: err?.message ?? 'Erro ao criar pagamento no Asaas' };
    }

    return charge;
  }

  async getPublicCharge(id: string) {
    const charge = await this.repository.findPublicCharge(id);

    if (!charge) throw this.fastify.httpErrors.notFound('Cobrança não encontrada');
    if (charge.status === 'cancelled') throw this.fastify.httpErrors.gone('Esta cobrança foi cancelada');
    if (charge.status === 'paid')      throw this.fastify.httpErrors.gone('Esta cobrança já foi paga');

    // Se tiver invoiceUrl, retorna para redirecionar o paciente para a página do Asaas
    if ((charge as any).asaas_invoice_url) {
      const settings = await this.repository.findSettings(charge.psychologist_id);
      return {
        amount:       Number(charge.amount),
        description:  charge.description,
        due_date:     charge.due_date,
        status:       charge.status,
        psychologist: settings?.beneficiary_name ?? '',
        invoice_url:  (charge as any).asaas_invoice_url,
      };
    }

    // Fallback: busca QR PIX pelo payment_id
    if (charge.asaas_payment_id) {
      const apiKey = await this.repository.findAsaasApiKey(charge.psychologist_id);
      if (apiKey) {
        try {
          const pix = await getAsaasPixQrCode(apiKey, charge.asaas_payment_id);
          const settings = await this.repository.findSettings(charge.psychologist_id);
          return {
            amount:       Number(charge.amount),
            description:  charge.description,
            due_date:     charge.due_date,
            status:       charge.status,
            psychologist: settings?.beneficiary_name ?? '',
            pix_payload:  pix.payload,
            pix_qr_image: pix.encodedImage,
          };
        } catch (err) {
          this.fastify.log.warn({ err }, '[asaas] Falha ao buscar QR do Asaas, usando fallback PIX manual');
        }
      }
    }

    // Fallback: PIX manual (chave configurada nas settings)
    const settings = await this.repository.findSettings(charge.psychologist_id);
    if (!settings?.pix_key) throw this.fastify.httpErrors.badRequest('Configuração PIX indisponível');

    const pixPayload = buildPixPayload({
      pixKey:       settings.pix_key,
      merchantName: settings.beneficiary_name,
      amount:       Number(charge.amount),
    });

    return {
      amount:       Number(charge.amount),
      description:  charge.description,
      due_date:     charge.due_date,
      status:       charge.status,
      psychologist: settings.beneficiary_name,
      pix_payload:  pixPayload,
    };
  }

  async syncChargeWithAsaas(chargeId: string, psychologistId: string) {
    const charge = await this.repository.findChargeById(chargeId, psychologistId);
    if (!charge) throw this.fastify.httpErrors.notFound('Cobrança não encontrada');
    if (charge.asaas_payment_id) return { already_synced: true, asaas_payment_id: charge.asaas_payment_id };

    await this.createAsaasPaymentAsync(psychologistId, chargeId, {
      patient_id:  charge.patient_id,
      amount:      charge.amount,
      description: charge.description,
      due_date:    charge.due_date,
    });

    const updated = await this.repository.findChargeById(chargeId, psychologistId);
    return { asaas_payment_id: updated?.asaas_payment_id ?? null };
  }

  async findChargeByAsaasPaymentId(asaasPaymentId: string) {
    return this.repository.findChargeByAsaasPaymentId(asaasPaymentId);
  }

  async updateStatusById(chargeId: string, status: string): Promise<void> {
    const paidAt = status === 'paid' ? new Date().toISOString() : null;
    await this.repository.updateStatusById(chargeId, status, paidAt);
  }

  async getSummary(psychologistId: string, month?: string): Promise<FinancialSummary> {
    return this.repository.getSummary(psychologistId, month);
  }

  async sendChargeEmail(chargeId: string, psychologistId: string): Promise<void> {
    const [charge, settings] = await Promise.all([
      this.repository.findChargeById(chargeId, psychologistId),
      this.repository.findSettings(psychologistId),
    ]);

    if (!charge) throw this.fastify.httpErrors.notFound('Cobrança não encontrada');
    if (!charge.patient?.email) throw this.fastify.httpErrors.badRequest('Paciente sem e-mail cadastrado');

    const emailParams: Parameters<typeof sendChargeEmail>[0] = {
      patientName:      charge.patient.full_name,
      patientEmail:     charge.patient.email,
      psychologistName: settings?.beneficiary_name ?? '',
      amount:           Number(charge.amount),
      description:      charge.description,
      dueDate:          charge.due_date,
      chargeId,
    };

    // Se tiver invoiceUrl, usa ela como link principal no email
    if ((charge as any).asaas_invoice_url) {
      emailParams.invoiceUrl = (charge as any).asaas_invoice_url;
    } else if (charge.asaas_payment_id) {
      // Fallback: busca QR PIX
      const apiKey = await this.repository.findAsaasApiKey(psychologistId);
      if (apiKey) {
        try {
          const pix = await getAsaasPixQrCode(apiKey, charge.asaas_payment_id);
          emailParams.asaasPixPayload = pix.payload;
          emailParams.asaasQrBase64  = pix.encodedImage;
        } catch (err) {
          this.fastify.log.warn({ err }, '[asaas] Falha ao buscar QR para email, usando fallback PIX manual');
        }
      }
    }

    // Fallback PIX manual
    if (!emailParams.asaasPixPayload) {
      if (!settings?.pix_key) throw this.fastify.httpErrors.badRequest('Configure sua chave PIX antes de enviar cobranças');
      emailParams.pixKey          = settings.pix_key;
      emailParams.beneficiaryName = settings.beneficiary_name;
    }

    await sendChargeEmail(emailParams);
  }

  // ── Carteira Asaas ──────────────────────────────────────────────────────────

  private async requireAsaasKey(psychologistId: string): Promise<string> {
    const apiKey = await this.repository.findAsaasApiKey(psychologistId);
    if (!apiKey) throw this.fastify.httpErrors.badRequest('Conta Asaas não conectada');
    return apiKey;
  }

  async getWalletBalance(psychologistId: string) {
    const apiKey = await this.requireAsaasKey(psychologistId);
    return getAsaasBalance(apiKey);
  }

  async getWalletStatement(
    psychologistId: string,
    params?: { startDate?: string; endDate?: string; limit?: number; offset?: number },
  ) {
    const apiKey = await this.requireAsaasKey(psychologistId);
    return getAsaasStatement(apiKey, params);
  }

  async getWalletTransfers(
    psychologistId: string,
    params?: { limit?: number; offset?: number },
  ) {
    const apiKey = await this.requireAsaasKey(psychologistId);
    return getAsaasTransfers(apiKey, params);
  }

  async createWalletTransfer(psychologistId: string, input: CreateTransferInput) {
    const apiKey = await this.requireAsaasKey(psychologistId);
    return createAsaasTransfer(apiKey, input);
  }
}
