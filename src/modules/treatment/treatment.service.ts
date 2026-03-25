import type { FastifyInstance } from "fastify";
import { TreatmentRepository } from "./treatment.repository";
import type {
  CreateTreatmentGoalInput,
  CreateTreatmentPlanInput,
  TreatmentGoal,
  TreatmentPlan,
  UpdateTreatmentGoalInput,
  UpdateTreatmentPlanInput,
} from "./treatment.types";

export class TreatmentService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly repository: TreatmentRepository
  ) {}

  private async ensurePsychologistOwnsPatientOrThrow(psychologistId: string, patientId: string) {
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

  private async ensurePlanOwnershipOrThrow(
    psychologistId: string,
    patientId: string,
    planId: string
  ): Promise<TreatmentPlan> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);

    const plan = await this.repository.getPlanById(planId);

    if (!plan) {
      throw this.fastify.httpErrors.notFound("Plano não encontrado.");
    }

    if (plan.patient_id !== patientId) {
      throw this.fastify.httpErrors.badRequest(
        "O plano informado não pertence ao paciente informado."
      );
    }

    if (plan.psychologist_id !== psychologistId) {
      throw this.fastify.httpErrors.forbidden(
        "Você não tem permissão para acessar este plano."
      );
    }

    return plan;
  }

  private async ensureGoalOwnershipOrThrow(
    psychologistId: string,
    patientId: string,
    planId: string,
    goalId: string
  ): Promise<TreatmentGoal> {
    await this.ensurePlanOwnershipOrThrow(psychologistId, patientId, planId);

    const goal = await this.repository.getGoalById(goalId);

    if (!goal) {
      throw this.fastify.httpErrors.notFound("Objetivo não encontrado.");
    }

    if (goal.plan_id !== planId) {
      throw this.fastify.httpErrors.badRequest(
        "O objetivo informado não pertence ao plano informado."
      );
    }

    if (goal.patient_id !== patientId) {
      throw this.fastify.httpErrors.badRequest(
        "O objetivo informado não pertence ao paciente informado."
      );
    }

    if (goal.psychologist_id !== psychologistId) {
      throw this.fastify.httpErrors.forbidden(
        "Você não tem permissão para acessar este objetivo."
      );
    }

    return goal;
  }

  async listPlans(psychologistId: string, patientId: string): Promise<TreatmentPlan[]> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);
    return this.repository.listPlansByPatientId(patientId);
  }

  async getActivePlan(psychologistId: string, patientId: string): Promise<TreatmentPlan | null> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);
    return this.repository.getActivePlanByPatientId(patientId);
  }

  async createPlan(
    psychologistId: string,
    patientId: string,
    input: CreateTreatmentPlanInput
  ): Promise<TreatmentPlan> {
    await this.ensurePsychologistOwnsPatientOrThrow(psychologistId, patientId);

    const sanitizedInput: CreateTreatmentPlanInput = { ...input };
    delete (sanitizedInput as Record<string, unknown>).patient_id;
    delete (sanitizedInput as Record<string, unknown>).psychologist_id;
    delete (sanitizedInput as Record<string, unknown>).goals;
    delete (sanitizedInput as Record<string, unknown>).id;
    delete (sanitizedInput as Record<string, unknown>).created_at;

    if (sanitizedInput.status === "active") {
      await this.repository.archiveActivePlansByPatientId(patientId);
    }

    return this.repository.createPlan({
      ...sanitizedInput,
      patient_id: patientId,
      psychologist_id: psychologistId,
    });
  }

  async updatePlan(
    psychologistId: string,
    patientId: string,
    planId: string,
    input: UpdateTreatmentPlanInput
  ): Promise<TreatmentPlan> {
    await this.ensurePlanOwnershipOrThrow(psychologistId, patientId, planId);

    const sanitizedInput: UpdateTreatmentPlanInput = { ...input };
    delete (sanitizedInput as Record<string, unknown>).patient_id;
    delete (sanitizedInput as Record<string, unknown>).psychologist_id;
    delete (sanitizedInput as Record<string, unknown>).goals;
    delete (sanitizedInput as Record<string, unknown>).id;
    delete (sanitizedInput as Record<string, unknown>).created_at;

    if (sanitizedInput.status === "active") {
      await this.repository.archiveActivePlansByPatientId(patientId);
    }

    return this.repository.updatePlanById(planId, sanitizedInput);
  }

  async deletePlan(psychologistId: string, patientId: string, planId: string): Promise<void> {
    await this.ensurePlanOwnershipOrThrow(psychologistId, patientId, planId);
    await this.repository.deletePlanById(planId);
  }

  async createGoal(
    psychologistId: string,
    patientId: string,
    planId: string,
    input: CreateTreatmentGoalInput
  ): Promise<TreatmentGoal> {
    await this.ensurePlanOwnershipOrThrow(psychologistId, patientId, planId);

    const completedAt =
      input.status === "completed" ? new Date().toISOString() : null;

    const sanitizedInput: CreateTreatmentGoalInput = { ...input };
    delete (sanitizedInput as Record<string, unknown>).patient_id;
    delete (sanitizedInput as Record<string, unknown>).psychologist_id;
    delete (sanitizedInput as Record<string, unknown>).plan_id;
    delete (sanitizedInput as Record<string, unknown>).id;
    delete (sanitizedInput as Record<string, unknown>).created_at;
    delete (sanitizedInput as Record<string, unknown>).completed_at;

    return this.repository.createGoal({
      ...sanitizedInput,
      plan_id: planId,
      patient_id: patientId,
      psychologist_id: psychologistId,
      completed_at: completedAt,
    });
  }

  async updateGoal(
    psychologistId: string,
    patientId: string,
    planId: string,
    goalId: string,
    input: UpdateTreatmentGoalInput
  ): Promise<TreatmentGoal> {
    await this.ensureGoalOwnershipOrThrow(psychologistId, patientId, planId, goalId);

    const sanitizedInput: Partial<TreatmentGoal> = { ...input };
    delete (sanitizedInput as Record<string, unknown>).patient_id;
    delete (sanitizedInput as Record<string, unknown>).psychologist_id;
    delete (sanitizedInput as Record<string, unknown>).plan_id;
    delete (sanitizedInput as Record<string, unknown>).id;
    delete (sanitizedInput as Record<string, unknown>).created_at;

    if (input.status !== undefined) {
      sanitizedInput.completed_at =
        input.status === "completed" ? new Date().toISOString() : null;
    }

    return this.repository.updateGoalById(goalId, sanitizedInput);
  }

  async deleteGoal(
    psychologistId: string,
    patientId: string,
    planId: string,
    goalId: string
  ): Promise<void> {
    await this.ensureGoalOwnershipOrThrow(psychologistId, patientId, planId, goalId);
    await this.repository.deleteGoalById(goalId);
  }
}