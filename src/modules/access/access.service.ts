import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { AccessRepository } from "./access.repository";
import { AccessStatus, ActivatePatientInput, PatientAccess } from "./access.types";

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

    const access = await this.repository.findByPatientAndPsychologist(
      patientId,
      psychologistId,
    );
    return access;
  }

  async createInvite(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAccess> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const inviteToken = crypto.randomBytes(24).toString("hex");
    const inviteCode = String(
      Math.floor(100000 + Math.random() * 900000),
    );
    const now = new Date().toISOString();

    const access = await this.repository.upsertInvite({
      patientId,
      psychologistId,
      inviteToken,
      inviteCode,
      now,
    });

    return access;
  }

  async activatePatient(input: ActivatePatientInput): Promise<{ userId: string }> {
    if (!input.token && !input.code) {
      throw this.fastify.httpErrors.badRequest(
        "Informe o token (link) ou o código de acesso.",
      );
    }

    const record = input.token
      ? await this.repository.findByToken(input.token)
      : await this.repository.findByCode(input.code!);

    if (!record) {
      throw this.fastify.httpErrors.notFound(
        "Convite não encontrado. Verifique o link ou o código.",
      );
    }

    if (record.status !== "invited") {
      throw this.fastify.httpErrors.conflict(
        "Este convite já foi utilizado ou foi revogado.",
      );
    }

    if (record.invite_expires_at && new Date(record.invite_expires_at) < new Date()) {
      throw this.fastify.httpErrors.gone(
        "Este convite expirou. Peça ao seu psicólogo para gerar um novo.",
      );
    }

    const { data: authData, error: authError } =
      await this.fastify.supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already been registered")) {
        throw this.fastify.httpErrors.conflict(
          "Este e-mail já possui uma conta. Entre em contato com seu psicólogo.",
        );
      }
      throw this.fastify.httpErrors.internalServerError(
        "Erro ao criar a conta. Tente novamente.",
      );
    }

    const now = new Date().toISOString();

    await this.repository.activateAccess({
      id: record.id,
      userId: authData.user.id,
      now,
    });

    return { userId: authData.user.id };
  }

  async updateStatus(
    patientId: string,
    psychologistId: string,
    status: AccessStatus,
  ): Promise<PatientAccess> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const existingAccess = await this.repository.findByPatientAndPsychologist(
      patientId,
      psychologistId,
    );

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

    const existingAccess = await this.repository.findByPatientAndPsychologist(
      patientId,
      psychologistId,
    );

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