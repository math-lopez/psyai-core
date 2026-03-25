import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { AccessRepository } from "./access.repository";
import { AccessStatus, PatientAccess } from "./access.types";

export class AccessService {
  private readonly repository: AccessRepository;

  constructor(private readonly fastify: FastifyInstance) {
    this.repository = new AccessRepository(fastify.supabaseAdmin);
  }

  private async assertPatientOwnership(
    patientId: string,
    psychologistId: string,
  ): Promise<void> {
    const patient = await this.repository.findOwnedPatientById(
      patientId,
      psychologistId,
    );

    if (!patient) {
      throw this.fastify.httpErrors.notFound(
        "Paciente não encontrado para o psicólogo autenticado",
      );
    }
  }

  async getAccessByPatientId(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAccess | null> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const access = await this.repository.findByPatientId(patientId);
    return access;
  }

  async createInvite(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAccess> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const inviteToken = crypto.randomBytes(24).toString("hex");
    const now = new Date().toISOString();

    const access = await this.repository.upsertInvite({
      patientId,
      psychologistId,
      inviteToken,
      now,
    });

    return access;
  }

  async updateStatus(
    patientId: string,
    psychologistId: string,
    status: AccessStatus,
  ): Promise<PatientAccess> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const existingAccess = await this.repository.findByPatientId(patientId);

    if (!existingAccess) {
      throw this.fastify.httpErrors.notFound(
        "Acesso do paciente não encontrado",
      );
    }

    const now = new Date().toISOString();

    const updated = await this.repository.updateStatus({
      patientId,
      psychologistId,
      status,
      now,
    });

    return updated;
  }

  async revokeAccess(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAccess> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const existingAccess = await this.repository.findByPatientId(patientId);

    if (!existingAccess) {
      throw this.fastify.httpErrors.notFound(
        "Acesso do paciente não encontrado",
      );
    }

    const now = new Date().toISOString();

    const updated = await this.repository.revokeAccess({
      patientId,
      psychologistId,
      now,
    });

    return updated;
  }
}