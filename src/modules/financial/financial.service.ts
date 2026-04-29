import { FastifyInstance } from "fastify";
import { FinancialRepository } from "./financial.repository";
import { FinancialCharge, FinancialSettings, FinancialSummary, UnbilledSession } from "./financial.types";

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

  async getSummary(psychologistId: string, month?: string): Promise<FinancialSummary> {
    return this.repository.getSummary(psychologistId, month);
  }
}
