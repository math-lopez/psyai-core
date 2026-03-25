import { SupabaseClient } from "@supabase/supabase-js";
import { PatientAIAnalysis } from "./analysis.types";

export class AnalysisRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findOwnedPatientById(patientId: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from("patients")
      .select("id, psychologist_id")
      .eq("id", patientId)
      .eq("psychologist_id", psychologistId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findLatestByPatientId(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAIAnalysis | null> {
    const { data, error } = await this.supabase
      .from("patient_ai_analyses")
      .select("*")
      .eq("patient_id", patientId)
      .eq("psychologist_id", psychologistId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Table may not exist yet – treat as "no analysis available"
      if (error.code === "PGRST205" || error.message?.includes("patient_ai_analyses")) {
        return null;
      }
      throw error;
    }

    return data as PatientAIAnalysis | null;
  }

  async createRequestedAnalysis(params: {
    patientId: string;
    psychologistId: string;
    now: string;
  }): Promise<PatientAIAnalysis | null> {
    const { data, error } = await this.supabase
      .from("patient_ai_analyses")
      .insert({
        patient_id: params.patientId,
        psychologist_id: params.psychologistId,
        status: "requested",
        requested_at: params.now,
        created_at: params.now,
        updated_at: params.now,
      })
      .select("*")
      .single();

    if (error) {
      // Table may not exist yet
      if (error.code === "PGRST205" || error.message?.includes("patient_ai_analyses")) {
        return null;
      }
      throw error;
    }

    return data as PatientAIAnalysis;
  }

  async markLatestAsRequestedIfReusable(params: {
    patientId: string;
    psychologistId: string;
    now: string;
  }): Promise<PatientAIAnalysis | null> {
    const latest = await this.findLatestByPatientId(
      params.patientId,
      params.psychologistId,
    );

    if (!latest) {
      return null;
    }

    if (latest.status === "requested" || latest.status === "processing") {
      return latest;
    }

    const { data, error } = await this.supabase
      .from("patient_ai_analyses")
      .insert({
        patient_id: params.patientId,
        psychologist_id: params.psychologistId,
        status: "requested",
        requested_at: params.now,
        created_at: params.now,
        updated_at: params.now,
      })
      .select("*")
      .single();

    if (error) {
      // Table may not exist yet
      if (error.code === "PGRST205" || error.message?.includes("patient_ai_analyses")) {
        return null;
      }
      throw error;
    }

    return data as PatientAIAnalysis;
  }
}
