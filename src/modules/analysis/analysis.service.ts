import { FastifyInstance } from "fastify";
import { AnalysisRepository } from "./analysis.repository";
import { AnalysisProcessor } from "./analysis.processor";
import { PatientAIAnalysis, RequestPatientAnalysisResult, SynthesisResult } from "./analysis.types";
import { PLAN_LIMITS, SubscriptionTier } from "../../config/plans";

export class AnalysisService {
  private readonly repository: AnalysisRepository;
  private readonly processor: AnalysisProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.repository = new AnalysisRepository(fastify.supabaseAdmin);
    this.processor = new AnalysisProcessor(fastify);
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

  async getLatestAnalysis(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAIAnalysis | null> {
    await this.assertPatientOwnership(patientId, psychologistId);

    return this.repository.findLatestByPatientId(patientId, psychologistId);
  }

  async requestAnalysis(
    patientId: string,
    psychologistId: string,
  ): Promise<RequestPatientAnalysisResult> {
    await this.assertPatientOwnership(patientId, psychologistId);

    const now = new Date().toISOString();

    const existingOrNew = await this.repository.markLatestAsRequestedIfReusable({
      patientId,
      psychologistId,
      now,
    });

    if (!existingOrNew) {
      await this.repository.createRequestedAnalysis({
        patientId,
        psychologistId,
        now,
      });
    }

    setImmediate(() => {
      this.processor
        .dispatch({ patientId, psychologistId })
        .then(() => {
          this.fastify.log.info(
            { patientId, psychologistId },
            "[analysis] processamento disparado com sucesso",
          );
        })
        .catch((error) => {
          this.fastify.log.error(
            { error, patientId, psychologistId },
            "[analysis] erro ao disparar processamento do paciente",
          );
        });
    });

    return {
      accepted: true,
      message: "Solicitação de análise recebida com sucesso",
    };
  }

  private async assertSynthesisQuota(psychologistId: string): Promise<void> {
    const { data: profile } = await this.fastify.supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", psychologistId)
      .single();

    const tier = (profile?.subscription_tier ?? "free") as SubscriptionTier;
    const limit = PLAN_LIMITS[tier]?.maxSynthesesPerMonth ?? 0;

    if (limit === 0) {
      throw this.fastify.httpErrors.forbidden(
        "Síntese IA está disponível apenas nos planos Profissional e Ultra.",
      );
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await this.fastify.supabaseAdmin
      .from("patient_ai_analyses")
      .select("id", { count: "exact", head: true })
      .eq("psychologist_id", psychologistId)
      .eq("status", "completed")
      .gte("completed_at", startOfMonth.toISOString())
      .contains("result_json", { type: "synthesis" });

    if ((count ?? 0) >= limit) {
      throw this.fastify.httpErrors.tooManyRequests(
        `Limite de ${limit} sínteses por mês atingido para o seu plano.`,
      );
    }
  }

  async synthesizePatient(
    patientId: string,
    psychologistId: string,
  ): Promise<SynthesisResult> {
    await this.assertSynthesisQuota(psychologistId);

    const patient = await this.repository.findPatientById(patientId, psychologistId);
    if (!patient) {
      throw this.fastify.httpErrors.notFound(
        "Paciente não encontrado para o psicólogo autenticado",
      );
    }

    const sessions = await this.repository.findSessionsForSynthesis(patientId, psychologistId);
    if (sessions.length === 0) {
      throw this.fastify.httpErrors.unprocessableEntity(
        "Nenhuma sessão encontrada para este paciente",
      );
    }

    const insightsUrl = process.env.INSIGHTS_SERVICE_URL;
    const insightsToken = process.env.INSIGHTS_SERVICE_TOKEN;

    if (!insightsUrl || !insightsToken) {
      throw this.fastify.httpErrors.serviceUnavailable(
        "Serviço de insights não configurado",
      );
    }

    const payload = {
      patientId: patient.id,
      psychologistId,
      patient: { id: patient.id, name: patient.full_name },
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionDate: s.session_date,
        transcript: s.transcript,
        manualNotes: s.manual_notes,
        clinicalNotes: s.clinical_notes,
        interventions: s.interventions,
        sessionSummaryManual: s.session_summary_manual,
        nextSteps: s.next_steps,
        highlights: s.highlights,
      })),
    };

    const response = await fetch(`${insightsUrl}/synthesize-patient`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${insightsToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      this.fastify.log.error(
        { patientId, status: response.status, body: text },
        "[synthesis] falha ao chamar insights service",
      );
      throw this.fastify.httpErrors.badGateway(
        "Falha ao gerar síntese do paciente",
      );
    }

    const result = (await response.json()) as SynthesisResult;

    const now = new Date().toISOString();
    await this.repository.saveSynthesisResult({
      patientId,
      psychologistId,
      resultJson: { ...result, type: "synthesis" },
      summaryText: result.summary,
      now,
    });

    return result;
  }
}