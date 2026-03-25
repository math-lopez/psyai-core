import { FastifyInstance } from 'fastify';
import { SessionRepository } from './session.repository';
import { CreateSessionInput, UpdateSessionInput } from './session.types';

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

  async analyzeSessionAI(sessionId: string, psychologistId: string) {
    const session = await this.repository.findRawByIdAndPsychologist(sessionId, psychologistId);

    if (!session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    const { data, error } = await this.app.supabase.functions.invoke('analyze-session-v2', {
      body: { sessionId },
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

    return this.repository.create(psychologistId, payload);
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
      processing_status: nextStatus,
    });

    if (nextStatus === 'queued') {
      await this.processAudio(id, psychologistId, userToken);
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