import type { FastifyInstance } from "fastify";
import type {
  CreateMyLogInput,
  CreatePromptInput,
  DiaryPatientContext,
  PatientLog,
  PatientLogPrompt,
  PatientPsychologistItem,
  UpdateMyLogInput,
  UpdatePromptInput,
} from "./diary.types";
import { DiaryRepository } from "./diary.repository";

export class DiaryService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly repository: DiaryRepository
  ) {}

  private async getPatientContextOrThrow(
    userId: string,
    psychologistId?: string,
  ): Promise<DiaryPatientContext> {
    if (psychologistId) {
      const context = await this.repository.getPatientAccessByUserAndPsychologist(
        userId,
        psychologistId,
      );

      if (!context) {
        throw this.fastify.httpErrors.forbidden(
          "Vínculo ativo não encontrado para o psicólogo selecionado."
        );
      }

      return {
        patientId: context.patient_id,
        psychologistId: context.psychologist_id,
        userId: context.user_id,
      };
    }

    // Sem psychologistId: auto-seleciona se houver exatamente um vínculo ativo
    const records = await this.repository.listPatientAccessByUserId(userId);

    if (records.length === 0) {
      throw this.fastify.httpErrors.forbidden(
        "Usuário autenticado não possui vínculo de portal do paciente."
      );
    }

    if (records.length > 1) {
      throw this.fastify.httpErrors.badRequest(
        "Você possui mais de um psicólogo vinculado. Informe o psychologistId."
      );
    }

    const record = records[0];
    return {
      patientId: record.patient_id,
      psychologistId: record.psychologist_id,
      userId: record.user_id,
    };
  }

  private async ensurePsychologistOwnsPatientOrThrow(
    psychologistId: string,
    patientId: string
  ) {
    const patient = await this.repository.getPatientOwnerById(patientId);

    if (!patient) {
      throw this.fastify.httpErrors.notFound("Paciente não encontrado.");
    }

    if (patient.psychologist_id !== psychologistId) {
      throw this.fastify.httpErrors.forbidden(
        "Você não tem permissão para acessar este paciente."
      );
    }

    return patient;
  }

  async listMyPsychologists(authUserId: string): Promise<PatientPsychologistItem[]> {
    const records = await this.repository.listPatientAccessByUserId(authUserId);

    if (records.length === 0) {
      throw this.fastify.httpErrors.forbidden(
        "Usuário autenticado não possui vínculo de portal do paciente."
      );
    }

    return records.map((r) => ({
      psychologistId: r.psychologist_id,
      patientId: r.patient_id,
    }));
  }

  async getMyContext(authUserId: string, psychologistId?: string) {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);

    return {
      patientId: context.patientId,
      psychologistId: context.psychologistId,
    };
  }

  async listMyLogs(authUserId: string, psychologistId?: string): Promise<PatientLog[]> {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);
    return this.repository.listLogsByPatientId(context.patientId);
  }

  async createMyLog(
    authUserId: string,
    psychologistId: string | undefined,
    input: CreateMyLogInput,
  ): Promise<PatientLog> {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);

    return this.repository.createLog({
      ...input,
      patient_id: context.patientId,
      psychologist_id: context.psychologistId,
    });
  }

  async updateMyLog(
    authUserId: string,
    psychologistId: string | undefined,
    logId: string,
    input: UpdateMyLogInput
  ): Promise<PatientLog> {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);

    const existing = await this.repository.getLogById(logId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound("Log não encontrado.");
    }

    if (existing.patient_id !== context.patientId) {
      throw this.fastify.httpErrors.forbidden(
        "Você não tem permissão para alterar este log."
      );
    }

    const sanitizedUpdates: UpdateMyLogInput = { ...input };
    delete (sanitizedUpdates as Record<string, unknown>).patient_id;
    delete (sanitizedUpdates as Record<string, unknown>).psychologist_id;
    delete (sanitizedUpdates as Record<string, unknown>).attachments;
    delete (sanitizedUpdates as Record<string, unknown>).id;
    delete (sanitizedUpdates as Record<string, unknown>).created_at;

    return this.repository.updateLogById(logId, sanitizedUpdates);
  }

  async deleteMyLog(authUserId: string, psychologistId: string | undefined, logId: string): Promise<void> {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);

    const existing = await this.repository.getLogById(logId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound("Log não encontrado.");
    }

    if (existing.patient_id !== context.patientId) {
      throw this.fastify.httpErrors.forbidden(
        "Você não tem permissão para excluir este log."
      );
    }

    await this.repository.deleteLogById(logId);
  }

  async listMyPrompts(authUserId: string, psychologistId?: string): Promise<PatientLogPrompt[]> {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);
    return this.repository.listPromptsByPatientId(context.patientId);
  }

  async updateMyPrompt(
    authUserId: string,
    psychologistId: string | undefined,
    promptId: string,
    input: UpdatePromptInput
  ): Promise<PatientLogPrompt> {
    const context = await this.getPatientContextOrThrow(authUserId, psychologistId);

    const existing = await this.repository.getPromptById(promptId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound("Prompt não encontrado.");
    }

    if (existing.patient_id !== context.patientId) {
      throw this.fastify.httpErrors.forbidden(
        "Você não tem permissão para alterar este prompt."
      );
    }

    const sanitizedUpdates: UpdatePromptInput = {
      status: input.status,
      completed_at: input.completed_at,
    };

    return this.repository.updatePromptById(promptId, sanitizedUpdates);
  }

  async createPatientLog(
    psychologistId: string,
    patientId: string,
    input: CreateMyLogInput
  ): Promise<PatientLog> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);

    return this.repository.createLog({
      ...input,
      patient_id: patientId,
      psychologist_id: psychologistId,
    });
  }

  async updatePatientLog(
    psychologistId: string,
    logId: string,
    input: UpdateMyLogInput
  ): Promise<PatientLog> {
    const existing = await this.repository.getLogById(logId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound('Log não encontrado.');
    }

    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, existing.patient_id);

    const sanitizedUpdates: UpdateMyLogInput = { ...input };
    delete (sanitizedUpdates as Record<string, unknown>).patient_id;
    delete (sanitizedUpdates as Record<string, unknown>).psychologist_id;
    delete (sanitizedUpdates as Record<string, unknown>).id;
    delete (sanitizedUpdates as Record<string, unknown>).created_at;

    return this.repository.updateLogById(logId, sanitizedUpdates);
  }

  async deletePatientLog(psychologistId: string, logId: string): Promise<void> {
    const existing = await this.repository.getLogById(logId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound('Log não encontrado.');
    }

    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, existing.patient_id);

    await this.repository.deleteLogById(logId);
  }

  async listPatientLogs(psychologistId: string, patientId: string): Promise<PatientLog[]> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);
    return this.repository.listLogsByPatientId(patientId);
  }

  async listPatientPrompts(
    psychologistId: string,
    patientId: string
  ): Promise<PatientLogPrompt[]> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);
    return this.repository.listPromptsByPatientId(patientId);
  }

  async createPatientPrompt(
    psychologistId: string,
    patientId: string,
    input: CreatePromptInput
  ): Promise<PatientLogPrompt> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);

    return this.repository.createPrompt({
      ...input,
      patient_id: patientId,
      psychologist_id: psychologistId,
    });
  }

  async updatePatientPrompt(
    psychologistId: string,
    patientId: string,
    promptId: string,
    input: UpdatePromptInput
  ): Promise<PatientLogPrompt> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);

    const existing = await this.repository.getPromptById(promptId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound("Prompt não encontrado.");
    }

    if (existing.patient_id !== patientId) {
      throw this.fastify.httpErrors.badRequest(
        "O prompt informado não pertence ao paciente informado."
      );
    }

    const sanitizedUpdates: UpdatePromptInput = { ...input };
    delete (sanitizedUpdates as Record<string, unknown>).patient_id;
    delete (sanitizedUpdates as Record<string, unknown>).psychologist_id;
    delete (sanitizedUpdates as Record<string, unknown>).id;
    delete (sanitizedUpdates as Record<string, unknown>).created_at;

    return this.repository.updatePromptById(promptId, sanitizedUpdates);
  }

  async deletePatientPrompt(
    psychologistId: string,
    patientId: string,
    promptId: string
  ): Promise<void> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);

    const existing = await this.repository.getPromptById(promptId);

    if (!existing) {
      throw this.fastify.httpErrors.notFound("Prompt não encontrado.");
    }

    if (existing.patient_id !== patientId) {
      throw this.fastify.httpErrors.badRequest(
        "O prompt informado não pertence ao paciente informado."
      );
    }

    await this.repository.deletePromptById(promptId);
  }
}