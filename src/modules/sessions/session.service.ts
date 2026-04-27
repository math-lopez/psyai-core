import { FastifyInstance } from 'fastify';
import { SessionRepository } from './session.repository';
import { CreateSessionInput, CreateRecurrentSessionInput, UpdateSessionInput } from './session.types';
import { PLAN_LIMITS, SubscriptionTier } from '../../config/plans';
import { sendSessionScheduledEmail } from '../../services/emailService';

function makeHttpError(statusCode: number, message: string) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

export class SessionService {
  private readonly repository: SessionRepository;

  constructor(private readonly app: FastifyInstance) {
    this.repository = new SessionRepository(app.supabase);
  }

  async getStats(psychologistId: string) {
    const [totalPatients, sessionStatuses] = await Promise.all([
      this.repository.countPatientsByPsychologist(psychologistId),
      this.repository.listSessionStatusesByPsychologist(psychologistId),
    ]);

    return {
      totalPatients,
      totalSessions: sessionStatuses.length,
      pendingProcessing: sessionStatuses.filter(
        (s) => s.processing_status === 'processing' || s.processing_status === 'queued'
      ).length,
      completedSessions: sessionStatuses.filter(
        (s) => s.processing_status === 'completed'
      ).length,
    };
  }

  async list(psychologistId: string) {
    return this.repository.listSessionsByPsychologist(psychologistId);
  }

  async getById(id: string, psychologistId: string) {
    const session = await this.repository.findByIdAndPsychologist(id, psychologistId);

    if (!session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    return session;
  }

  async getSessionAIAnalysis(sessionId: string, psychologistId: string) {
    const session = await this.repository.findRawByIdAndPsychologist(sessionId, psychologistId);

    if (!session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    return this.repository.getSessionAIAnalysis(sessionId);
  }

  async analyzeSessionAI(sessionId: string, psychologistId: string, userToken?: string) {
    const session = await this.repository.findRawByIdAndPsychologist(sessionId, psychologistId);

    if (!session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    const { data, error } = await this.app.supabase.functions.invoke('analyze-session-v2', {
      body: { sessionId },
      headers: userToken ? { Authorization: `Bearer ${userToken}` } : undefined,
    });

    if (error) {
      throw makeHttpError(500, 'Erro ao solicitar análise profunda da sessão');
    }

    return data;
  }

  async create(psychologistId: string, payload: CreateSessionInput) {
    const patientBelongs = await this.repository.patientBelongsToPsychologist(
      payload.patient_id,
      psychologistId
    );

    if (!patientBelongs) {
      throw makeHttpError(403, 'Paciente não pertence ao psicólogo autenticado');
    }

    const tier = (await this.repository.getSubscriptionTier(psychologistId)) as SubscriptionTier;
    const safeTier = PLAN_LIMITS[tier] ? tier : 'free';
    const limit = PLAN_LIMITS[safeTier].maxSessionsPerMonth;

    if (limit !== Infinity) {
      const currentCount = await this.repository.countSessionsThisMonth(psychologistId);
      if (currentCount >= limit) {
        throw makeHttpError(
          403,
          `Limite atingido! Seu plano ${PLAN_LIMITS[safeTier].name} permite apenas ${limit} sessões por mês. Faça um upgrade para continuar.`
        );
      }
    }

    const session = await this.repository.create(psychologistId, payload);

    // Dispara o email sem bloquear a resposta
    this.sendScheduledEmail(psychologistId, payload.patient_id, payload.session_date).catch((err) => {
      this.app.log.error({ err }, 'Falha ao enviar email de sessão agendada');
      console.error('[email] Falha ao enviar email de sessão agendada:', err?.message ?? err);
    });

    return session;
  }

  private async sendScheduledEmail(psychologistId: string, patientId: string, sessionDate: string) {
    console.log(`[email] sendScheduledEmail chamado — patientId=${patientId}`);

    const [patient, psychologistName] = await Promise.all([
      this.repository.findPatientById(patientId),
      this.repository.findPsychologistNameById(psychologistId),
    ]);

    console.log(`[email] patient encontrado: ${JSON.stringify(patient)}`);

    if (!patient?.email) {
      console.log('[email] Paciente sem email cadastrado, abortando envio.');
      return;
    }

    await sendSessionScheduledEmail({
      patientName: patient.full_name,
      patientEmail: patient.email,
      psychologistName: psychologistName || 'seu psicólogo',
      sessionDate,
    });
  }

  async listByPatient(patientId: string, psychologistId: string) {
    const patientBelongs = await this.repository.patientBelongsToPsychologist(patientId, psychologistId);
    if (!patientBelongs) {
      throw makeHttpError(403, 'Paciente não pertence ao psicólogo autenticado');
    }
    return this.repository.listSessionsByPatient(patientId, psychologistId);
  }

  async cancelSession(id: string, psychologistId: string) {
    const existing = await this.repository.findRawByIdAndPsychologist(id, psychologistId);
    if (!existing) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }
    await this.repository.update(id, psychologistId, { status: 'cancelled', processing_status: 'cancelled' as any });
    return { success: true };
  }

  async createRecurrent(psychologistId: string, payload: CreateRecurrentSessionInput) {
    const patientBelongs = await this.repository.patientBelongsToPsychologist(
      payload.patient_id,
      psychologistId
    );

    if (!patientBelongs) {
      throw makeHttpError(403, 'Paciente não pertence ao psicólogo autenticado');
    }

    const tier = (await this.repository.getSubscriptionTier(psychologistId)) as SubscriptionTier;
    const safeTier = PLAN_LIMITS[tier] ? tier : 'free';
    const limit = PLAN_LIMITS[safeTier].maxSessionsPerMonth;

    const { until_date, session_date, ...baseFields } = payload;

    const rows = [];
    let currentDate = new Date(session_date);
    const limitDate = new Date(until_date);

    if (isNaN(currentDate.getTime()) || isNaN(limitDate.getTime())) {
      throw makeHttpError(400, 'Datas inválidas');
    }

    if (limitDate < currentDate) {
      throw makeHttpError(400, 'until_date deve ser posterior a session_date');
    }

    while (currentDate <= limitDate) {
      rows.push({
        ...baseFields,
        session_date: currentDate.toISOString(),
        psychologist_id: psychologistId,
        processing_status: 'draft',
      });
      currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    if (limit !== Infinity) {
      const currentCount = await this.repository.countSessionsThisMonth(psychologistId);
      const thisMonthRows = rows.filter((r) => {
        const d = new Date(r.session_date);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
      if (currentCount + thisMonthRows.length > limit) {
        throw makeHttpError(
          403,
          `Limite atingido! Seu plano ${PLAN_LIMITS[safeTier].name} permite apenas ${limit} sessões por mês. Faça um upgrade para continuar.`
        );
      }
    }

    return this.repository.createMany(rows);
  }

  async update(id: string, psychologistId: string, payload: UpdateSessionInput) {
    const existing = await this.repository.findRawByIdAndPsychologist(id, psychologistId);

    if (!existing) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    if (payload.patient_id) {
      const patientBelongs = await this.repository.patientBelongsToPsychologist(
        payload.patient_id,
        psychologistId
      );

      if (!patientBelongs) {
        throw makeHttpError(403, 'Paciente não pertence ao psicólogo autenticado');
      }
    }

    const updated = await this.repository.update(id, psychologistId, payload);

    if (!updated) {
      throw makeHttpError(500, 'Erro ao atualizar sessão');
    }

    return updated;
  }

  async delete(id: string, psychologistId: string) {
    const existing = await this.repository.findRawByIdAndPsychologist(id, psychologistId);

    if (!existing) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    await this.repository.delete(id, psychologistId);
    return { success: true };
  }

  async finishSession(id: string, psychologistId: string, userToken: string) {
    const session = await this.repository.findRawByIdAndPsychologist(id, psychologistId);

    if (!session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    const nextStatus =
      session.audio_file_path && session.processing_status === 'draft'
        ? 'queued'
        : 'completed';

    await this.repository.update(id, psychologistId, {
      status: 'completed',
      processing_status: nextStatus,
    });

    if (nextStatus === 'queued') {
      await this.processAudio(id, psychologistId, userToken);
    }

    // Dispara análise de insights apenas para planos pro/ultra
    const tier = (await this.repository.getSubscriptionTier(psychologistId)) as SubscriptionTier;
    const safeTier = PLAN_LIMITS[tier] ? tier : 'free';
    if (PLAN_LIMITS[safeTier].hasTherapeuticInsights) {
      this.analyzeSessionAI(id, psychologistId, userToken).catch((err) => {
        this.app.log.error({ err }, '[insights] Falha ao disparar análise automática da sessão');
      });
    }

    return { success: true, processing_status: nextStatus };
  }

  async processAudio(sessionId: string, psychologistId: string, userToken: string) {
  const session = await this.repository.findRawByIdAndPsychologist(sessionId, psychologistId);

  if (!session) {
    throw makeHttpError(404, 'Sessão não encontrada');
  }

  const { error } = await this.app.supabase.functions.invoke('process-session-audio', {
    body: { sessionId },
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  if (error) {
    throw makeHttpError(500, 'Erro ao solicitar processamento do áudio');
  }

  return { success: true };
}}