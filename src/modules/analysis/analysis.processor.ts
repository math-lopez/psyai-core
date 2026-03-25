import { FastifyInstance } from "fastify";

export class AnalysisProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async dispatch(params: {
    patientId: string;
    psychologistId: string;
  }): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const internalToken = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL não configurada");
    }

    if (!internalToken) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurado");
    }

    const functionUrl = `${supabaseUrl}/functions/v1/process-patient-analysis`;

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": internalToken,
      },
      body: JSON.stringify({
        patientId: params.patientId,
        psychologistId: params.psychologistId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Falha ao disparar process-patient-analysis: ${response.status} - ${text}`,
      );
    }
  }
}