import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateMyLogInput,
  CreatePromptInput,
  PatientAccessRecord,
  PatientLog,
  PatientLogPrompt,
  PatientOwnerRecord,
  UpdateMyLogInput,
  UpdatePromptInput,
} from "./diary.types";

export class DiaryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getPatientAccessByUserId(userId: string): Promise<PatientAccessRecord | null> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .select("patient_id, psychologist_id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getPatientOwnerById(patientId: string): Promise<PatientOwnerRecord | null> {
    const { data, error } = await this.supabase
      .from("patients")
      .select("id, psychologist_id")
      .eq("id", patientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async listLogsByPatientId(patientId: string): Promise<PatientLog[]> {
    const { data, error } = await this.supabase
      .from("patient_logs")
      .select("*, attachments:patient_log_attachments(*)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PatientLog[];
  }

  async getLogById(logId: string): Promise<PatientLog | null> {
    const { data, error } = await this.supabase
      .from("patient_logs")
      .select("*, attachments:patient_log_attachments(*)")
      .eq("id", logId)
      .maybeSingle();

    if (error) throw error;
    return data as PatientLog | null;
  }

  async createLog(
    payload: CreateMyLogInput & {
      patient_id: string;
      psychologist_id: string;
    }
  ): Promise<PatientLog> {
    const { data, error } = await this.supabase
      .from("patient_logs")
      .insert([payload])
      .select("*, attachments:patient_log_attachments(*)")
      .single();

    if (error) throw error;
    return data as PatientLog;
  }

  async updateLogById(logId: string, updates: UpdateMyLogInput): Promise<PatientLog> {
    const { data, error } = await this.supabase
      .from("patient_logs")
      .update(updates)
      .eq("id", logId)
      .select("*, attachments:patient_log_attachments(*)")
      .single();

    if (error) throw error;
    return data as PatientLog;
  }

  async deleteLogById(logId: string): Promise<void> {
    const { error } = await this.supabase
      .from("patient_logs")
      .delete()
      .eq("id", logId);

    if (error) throw error;
  }

  async listPromptsByPatientId(patientId: string): Promise<PatientLogPrompt[]> {
    const { data, error } = await this.supabase
      .from("patient_log_prompts")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PatientLogPrompt[];
  }

  async getPromptById(promptId: string): Promise<PatientLogPrompt | null> {
    const { data, error } = await this.supabase
      .from("patient_log_prompts")
      .select("*")
      .eq("id", promptId)
      .maybeSingle();

    if (error) throw error;
    return data as PatientLogPrompt | null;
  }

  async createPrompt(
    payload: CreatePromptInput & {
      patient_id: string;
      psychologist_id: string;
    }
  ): Promise<PatientLogPrompt> {
    const { data, error } = await this.supabase
      .from("patient_log_prompts")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;
    return data as PatientLogPrompt;
  }

  async updatePromptById(
    promptId: string,
    updates: UpdatePromptInput
  ): Promise<PatientLogPrompt> {
    const { data, error } = await this.supabase
      .from("patient_log_prompts")
      .update(updates)
      .eq("id", promptId)
      .select("*")
      .single();

    if (error) throw error;
    return data as PatientLogPrompt;
  }

  async deletePromptById(promptId: string): Promise<void> {
    const { error } = await this.supabase
      .from("patient_log_prompts")
      .delete()
      .eq("id", promptId);

    if (error) throw error;
  }
}