import { FastifyInstance } from "fastify";
import { AnalysisRepository } from "./analysis.repository";
import { AnalysisProcessor } from "./analysis.processor";
import { PatientAIAnalysis, RequestPatientAnalysisResult } from "./analysis.types";

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
}