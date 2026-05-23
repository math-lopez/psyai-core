import { PLAN_LIMITS, SubscriptionTier } from '../../config/plans';
import { PatientRepository } from './patient.repository';
import { CreatePatientInput, UpdatePatientInput } from './patient.types';
import { FastifyInstance } from 'fastify';

function isMinor(birthDate: string): boolean {
  const birth = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 < 18;
  }
  return age < 18;
}

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

  private validateGuardians(birthDate: string, guardians?: CreatePatientInput['guardians']) {
    if (!isMinor(birthDate)) return;

    if (!guardians || guardians.length === 0) {
      throw this.app.httpErrors.badRequest(
        'Paciente menor de idade deve ter ao menos um responsável cadastrado.'
      );
    }

    if (guardians.length > 3) {
      throw this.app.httpErrors.badRequest('Máximo de 3 responsáveis permitidos.');
    }
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

    this.validateGuardians(payload.birth_date, payload.guardians);

    return this.repository.create(psychologistId, payload);
  }

  async update(id: string, psychologistId: string, payload: UpdatePatientInput) {
    const existing = await this.repository.findByIdAndPsychologist(id, psychologistId);

    if (!existing) {
      throw this.app.httpErrors.notFound('Paciente não encontrado');
    }

    const birthDate = payload.birth_date ?? existing.birth_date;
    this.validateGuardians(birthDate, payload.guardians ?? existing.guardians);

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
      this.app.log.error({ err, patientId: id }, `Falha no deletePatientCascade: ${detail}`);
      throw this.app.httpErrors.internalServerError(
        `Erro ao realizar a exclusão completa do paciente: ${detail}`
      );
    }

    return { success: true };
  }
}
