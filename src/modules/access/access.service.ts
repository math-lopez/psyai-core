import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { AccessRepository } from "./access.repository";
import { AccessStatus, ActivatePatientInput, PatientAccess, PatientAccessResponse } from "./access.types";

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
  ): Promise<PatientAccessResponse | null> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const access = await this.repository.findByPatientAndPsychologist(
      patientId,
      psychologistId,
    );

    if (access) return access;

    // Paciente não tem vínculo com este psicólogo, mas pode já ter conta ativa em outro
    const anyActive = await this.repository.findAnyActiveByPatientEmail(patientId);
    if (anyActive) {
      // Retorna registro sintético: paciente tem conta mas ainda sem vínculo com este psicólogo.
      // status 'inactive' faz o frontend mostrar o bloco de "Paciente já possui conta" + "Reativar Acesso".
      return {
        ...anyActive,
        psychologist_id: psychologistId,
        status: "inactive" as PatientAccess["status"],
        has_linked_account: true,
        invited_at: null,
        accepted_at: null,
        suspended_at: null,
        revoked_at: null,
        invite_token: null,
        invite_code: null,
        invite_expires_at: null,
      };
    }

    return null;
  }

  async createInvite(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAccess> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const existing = await this.repository.findByPatientAndPsychologist(
      patientId,
      psychologistId,
    );

    // Já tem vínculo com este psicólogo e user_id → só reativa
    if (existing?.user_id) {
      const now = new Date().toISOString();
      return this.repository.updateStatus({
        patientId,
        psychologistId,
        status: "active",
        now,
      });
    }

    // Sem vínculo com este psicólogo, mas paciente já tem conta em outro vínculo → vincula direto
    const anyActive = await this.repository.findAnyActiveByPatientEmail(patientId);
    if (anyActive?.user_id) {
      const now = new Date().toISOString();
      return this.repository.upsertActiveAccess({
        patientId,
        psychologistId,
        userId: anyActive.user_id,
        now,
      });
    }

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

    let userId: string;

    const { data: authData, error: authError } =
      await this.fastify.supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        // Paciente já tem conta — busca o user_id existente e vincula ao novo acesso
        const { data: users } =
          await this.fastify.supabaseAdmin.auth.admin.listUsers();
        const existing = users?.users?.find((u) => u.email === input.email);

        if (!existing) {
          throw this.fastify.httpErrors.internalServerError(
            "Erro ao localizar conta existente.",
          );
        }

        userId = existing.id;
      } else {
        throw this.fastify.httpErrors.internalServerError(
          "Erro ao criar a conta. Tente novamente.",
        );
      }
    } else if (!authData.user) {
      throw this.fastify.httpErrors.internalServerError(
        "Erro ao criar a conta. Tente novamente.",
      );
    } else {
      userId = authData.user.id;

      // Força confirmação do email — email_confirm no createUser não é suficiente
      // em alguns projetos Supabase (envia email ao invés de confirmar direto)
      await this.fastify.supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
    }

    const now = new Date().toISOString();

    await this.repository.activateAccess({
      id: record.id,
      userId,
      now,
    });

    return { userId };
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