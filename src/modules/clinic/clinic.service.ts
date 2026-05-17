import { FastifyInstance } from 'fastify';
import { ClinicRepository } from './clinic.repository';
import {
  CreateClinicInput,
  UpdateClinicInput,
  CreateMemberInput,
  UpdateMemberInput,
} from './clinic.types';

export interface RegisterClinicInput {
  clinic_name: string;
  owner_name: string;
  email: string;
  password: string;
  cnpj: string;
  phone?: string;
}

// Suporta o formato alfanumérico da Receita Federal (vigente jul/2026).
// Aceita 14 caracteres após remover pontuação: dígitos e letras maiúsculas.
function validateCnpj(cnpj: string): void {
  const clean = cnpj.replace(/[.\-\/]/g, '').toUpperCase();
  if (clean.length !== 14 || !/^[A-Z0-9]{14}$/.test(clean)) {
    throw new Error('CNPJ inválido. Informe 14 caracteres alfanuméricos.');
  }
  if (/^(.)\1+$/.test(clean)) {
    throw new Error('CNPJ inválido. Verifique os dados informados.');
  }
}

const CLINIC_MEMBER_LIMITS: Record<string, number> = {
  clinic_starter: 3,
  clinic_pro: 10,
  clinic_enterprise: Infinity,
};

export class ClinicService {
  private readonly repository: ClinicRepository;

  constructor(private readonly app: FastifyInstance) {
    this.repository = new ClinicRepository(app.supabase);
  }

  async getMyClinic(userId: string) {
    const asOwner = await this.repository.findByOwnerId(userId);
    if (asOwner) return asOwner;

    const asMember = await this.repository.findByMemberId(userId);
    if (asMember) return (asMember as any).clinics;

    throw this.app.httpErrors.notFound('Clínica não encontrada');
  }

  async create(ownerId: string, payload: CreateClinicInput) {
    const existing = await this.repository.findByOwnerId(ownerId);
    if (existing) {
      throw this.app.httpErrors.conflict('Você já possui uma clínica cadastrada');
    }

    return this.repository.create(ownerId, payload);
  }

  async update(userId: string, payload: UpdateClinicInput) {
    const clinic = await this.repository.findByOwnerId(userId);
    if (!clinic) {
      throw this.app.httpErrors.forbidden('Apenas o dono da clínica pode editar os dados');
    }

    const updated = await this.repository.update(clinic.id, payload);
    if (!updated) {
      throw this.app.httpErrors.internalServerError('Erro ao atualizar clínica');
    }

    return updated;
  }

  async listMembers(userId: string) {
    const clinic = await this.resolveClinicForAdmin(userId);
    return this.repository.listMembers(clinic.id);
  }

  async addMember(adminId: string, payload: CreateMemberInput) {
    const clinic = await this.resolveClinicForAdmin(adminId);

    const limit = CLINIC_MEMBER_LIMITS[clinic.subscription_tier] ?? 3;
    const current = await this.repository.countActiveMembers(clinic.id);
    if (current >= limit) {
      throw this.app.httpErrors.forbidden(
        `Limite de psicólogos atingido para o plano atual (${limit}). Faça um upgrade para continuar.`
      );
    }

    // Cria o usuário Supabase via Admin API
    const { data: newUser, error: createError } = await this.app.supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.full_name, account_type: 'clinic_psychologist', clinic_id: clinic.id },
    });

    if (createError || !newUser.user) {
      const msg = createError?.message ?? 'Erro ao criar usuário';
      throw this.app.httpErrors.badRequest(msg);
    }

    const userId = newUser.user.id;

    // Garante que o perfil existe (pode não ter sido criado pelo trigger ainda)
    await this.app.supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: payload.full_name,
        email: payload.email,
        subscription_tier: 'free',
        subscription_status: 'active',
      }, { onConflict: 'id' });

    const member = await this.repository.addMember(
      clinic.id,
      userId,
      payload.role ?? 'psychologist',
      adminId,
    );

    return member;
  }

  async updateMember(adminId: string, memberId: string, payload: UpdateMemberInput) {
    const clinic = await this.resolveClinicForAdmin(adminId);

    const member = await this.repository.findMemberById(memberId);
    if (!member || member.clinic_id !== clinic.id) {
      throw this.app.httpErrors.notFound('Membro não encontrado');
    }

    // Impede que o admin suspenda a si mesmo
    if (member.user_id === adminId && payload.status === 'suspended') {
      throw this.app.httpErrors.badRequest('Você não pode suspender sua própria conta');
    }

    const updated = await this.repository.updateMemberStatus(memberId, payload.status);
    if (!updated) {
      throw this.app.httpErrors.internalServerError('Erro ao atualizar membro');
    }

    // Sincroniza o account_type no JWT para refletir imediatamente no próximo login
    const newAccountType = payload.status === 'suspended' ? 'clinic_suspended' : 'clinic_psychologist';
    await this.app.supabaseAdmin.auth.admin.updateUserById(member.user_id, {
      user_metadata: { account_type: newAccountType },
    });

    return updated;
  }

  async register(payload: RegisterClinicInput) {
    try {
      validateCnpj(payload.cnpj);
    } catch (err: any) {
      throw this.app.httpErrors.badRequest(err.message ?? 'CNPJ inválido');
    }

    const { data: newUser, error: createError } = await this.app.supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.owner_name, account_type: 'clinic_admin' },
    });

    if (createError || !newUser.user) {
      throw this.app.httpErrors.badRequest(createError?.message ?? 'Erro ao criar usuário');
    }

    const ownerId = newUser.user.id;

    await this.app.supabaseAdmin
      .from('profiles')
      .upsert({
        id: ownerId,
        full_name: payload.owner_name,
        email: payload.email,
        subscription_tier: 'free',
        subscription_status: 'active',
      }, { onConflict: 'id' });

    const clinic = await this.repository.create(ownerId, {
      name: payload.clinic_name,
      cnpj: payload.cnpj,
      phone: payload.phone,
    });

    // Atualiza metadata com clinic_id para o frontend ler do JWT sem queries
    await this.app.supabaseAdmin.auth.admin.updateUserById(ownerId, {
      user_metadata: { full_name: payload.owner_name, account_type: 'clinic_admin', clinic_id: clinic.id },
    });

    await this.repository.addMember(clinic.id, ownerId, 'admin', ownerId);

    return { clinic, user_id: ownerId };
  }

  async getClinicPatients(adminId: string) {
    const clinic = await this.resolveClinicForAdmin(adminId);
    return this.repository.listClinicPatients(clinic.id);
  }

  async getClinicStats(adminId: string) {
    const clinic = await this.resolveClinicForAdmin(adminId);
    return this.repository.getClinicStats(clinic.id);
  }

  async getClinicFinancial(adminId: string) {
    const clinic = await this.resolveClinicForAdmin(adminId);
    return this.repository.getClinicFinancial(clinic.id);
  }

  async transferPatient(adminId: string, patientId: string, toPsychologistId: string) {
    const clinic = await this.resolveClinicForAdmin(adminId);

    const members = await this.repository.listMembers(clinic.id);
    const memberIds = members.map((m: any) => m.user_id);

    if (!memberIds.includes(toPsychologistId)) {
      throw this.app.httpErrors.badRequest('O psicólogo de destino não pertence a esta clínica');
    }

    const patients = await this.repository.listClinicPatients(clinic.id);
    const patient = patients.find((p: any) => p.id === patientId);
    if (!patient) {
      throw this.app.httpErrors.notFound('Paciente não encontrado nesta clínica');
    }

    if (patient.psychologist_id === toPsychologistId) {
      throw this.app.httpErrors.badRequest('O paciente já pertence a este psicólogo');
    }

    await this.repository.transferPatient(patientId, toPsychologistId);
    return { success: true };
  }

  async removeMember(adminId: string, memberId: string) {
    const clinic = await this.resolveClinicForAdmin(adminId);

    const member = await this.repository.findMemberById(memberId);
    if (!member || member.clinic_id !== clinic.id) {
      throw this.app.httpErrors.notFound('Membro não encontrado');
    }

    if (member.user_id === adminId) {
      throw this.app.httpErrors.badRequest('Você não pode remover a si mesmo da clínica');
    }

    await this.repository.removeMember(memberId);

    // Marca como solo — mantém acesso ao sistema sem vínculo com a clínica
    await this.app.supabaseAdmin.auth.admin.updateUserById(member.user_id, {
      user_metadata: { account_type: 'solo_psychologist', clinic_id: null },
    });

    return { success: true };
  }

  private async resolveClinicForAdmin(userId: string) {
    const clinic = await this.repository.findByOwnerId(userId);
    if (clinic) return clinic;

    // Verifica se é admin membro
    const membership = await this.repository.findByMemberId(userId);
    if (membership && (membership as any).role === 'admin') {
      return (membership as any).clinics;
    }

    throw this.app.httpErrors.forbidden('Acesso restrito a administradores de clínica');
  }
}
