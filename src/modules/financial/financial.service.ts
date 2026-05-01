import { FastifyInstance } from "fastify";
import { FinancialRepository } from "./financial.repository";
import { FinancialCharge, FinancialSettings, FinancialSummary, UnbilledSession } from "./financial.types";
import { sendChargeEmail } from "../../services/emailService";
import { buildPixPayload } from "../../lib/pix";

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

  async listCharges(
    psychologistId: string,
    filters: { status?: string; patientId?: string; from?: string; to?: string },
  ): Promise<FinancialCharge[]> {
    return this.repository.listCharges(psychologistId, filters);
  }

  async createCharge(
    psychologistId: string,
    payload: Pick<FinancialCharge, "patient_id" | "session_id" | "amount" | "description" | "due_date" | "notes">,
  ): Promise<FinancialCharge> {
    return this.repository.createCharge(psychologistId, payload);
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
  ): Promise<FinancialCharge> {
    if (!sessionIds.length) throw this.fastify.httpErrors.badRequest("Selecione ao menos uma sessão");
    const amount = Number((sessionValue * sessionIds.length).toFixed(2));
    return this.repository.closePeriod({ psychologistId, patientId, sessionIds, amount, description });
  }

  async getPublicCharge(id: string) {
    const charge = await this.repository.findPublicCharge(id);

    if (!charge) throw this.fastify.httpErrors.notFound('Cobrança não encontrada');

    if (charge.status === 'cancelled') throw this.fastify.httpErrors.gone('Esta cobrança foi cancelada');
    if (charge.status === 'paid')      throw this.fastify.httpErrors.gone('Esta cobrança já foi paga');

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

  async getSummary(psychologistId: string, month?: string): Promise<FinancialSummary> {
    return this.repository.getSummary(psychologistId, month);
  }

  async sendChargeEmail(chargeId: string, psychologistId: string): Promise<void> {
    const [charge, settings] = await Promise.all([
      this.repository.findChargeById(chargeId, psychologistId),
      this.repository.findSettings(psychologistId),
    ]);

    if (!charge) throw this.fastify.httpErrors.notFound('Cobrança não encontrada');
    if (!settings?.pix_key) throw this.fastify.httpErrors.badRequest('Configure sua chave PIX antes de enviar cobranças');
    if (!charge.patient?.email) throw this.fastify.httpErrors.badRequest('Paciente sem e-mail cadastrado');

    await sendChargeEmail({
      patientName:      charge.patient.full_name,
      patientEmail:     charge.patient.email,
      psychologistName: settings.beneficiary_name,
      amount:           Number(charge.amount),
      description:      charge.description,
      dueDate:          charge.due_date,
      pixKey:           settings.pix_key,
      beneficiaryName:  settings.beneficiary_name,
      chargeId:         chargeId,
    });
  }
}
