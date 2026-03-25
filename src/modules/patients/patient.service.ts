import { PLAN_LIMITS, SubscriptionTier } from '../../config/plans';
import { PatientRepository } from './patient.repository';
import { CreatePatientInput, UpdatePatientInput } from './patient.types';
import { FastifyInstance } from 'fastify';

export class PatientService {
  private readonly repository: PatientRepository;

  constructor(private readonly app: FastifyInstance) {
    this.repository = new PatientRepository(app.supabase);
  }

  async list(psychologistId: string) {
    return this.repository.listByPsychologist(psychologistId);
  }

  async getById(id: string, psychologistId: string) {
    const patient = await this.repository.findByIdAndPsychologist(id, psychologistId);

    if (!patient) {
      throw this.app.httpErrors.notFound('Paciente não encontrado');
    }

    return patient;
  }

  async create(psychologistId: string, payload: CreatePatientInput) {
    const tier = (await this.repository.getSubscriptionTier(psychologistId)) as SubscriptionTier;
    const safeTier = PLAN_LIMITS[tier] ? tier : 'free';

    const currentCount = await this.repository.countByPsychologist(psychologistId);
    const limit = PLAN_LIMITS[safeTier].maxPatients;

    if (currentCount >= limit) {
      throw this.app.httpErrors.forbidden(
        `Limite atingido! Seu plano ${PLAN_LIMITS[safeTier].name} permite apenas ${limit} pacientes. Faça um upgrade para continuar.`
      );
    }

    return this.repository.create(psychologistId, payload);
  }

  async update(id: string, psychologistId: string, payload: UpdatePatientInput) {
    const existing = await this.repository.findByIdAndPsychologist(id, psychologistId);

    if (!existing) {
      throw this.app.httpErrors.notFound('Paciente não encontrado');
    }

    const updated = await this.repository.update(id, psychologistId, payload);

    if (!updated) {
      throw this.app.httpErrors.internalServerError('Erro ao atualizar paciente');
    }

    return updated;
  }

  async delete(id: string, psychologistId: string) {
    const existing = await this.repository.findByIdAndPsychologist(id, psychologistId);

    if (!existing) {
      throw this.app.httpErrors.notFound('Paciente não encontrado');
    }

    try {
      await this.repository.deletePatientCascade(id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.app.log.error({ err, patientId: id }, `deletePatientCascade failed: ${detail}`);
      throw this.app.httpErrors.internalServerError(
        'Erro ao realizar a exclusão completa do paciente.'
      );
    }

    return { success: true };
  }
}
