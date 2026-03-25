import { SupabaseClient } from "@supabase/supabase-js";
import { AttachmentVisibility, PatientAttachment } from "./attachment.types";

export class AttachmentRepository {
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

  async listByPatientId(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAttachment[]> {
    const { data, error } = await this.supabase
      .from("patient_attachments")
      .select("*")
      .eq("patient_id", patientId)
      .eq("psychologist_id", psychologistId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as PatientAttachment[];
  }

  async findById(params: {
    attachmentId: string;
    patientId: string;
    psychologistId: string;
  }): Promise<PatientAttachment | null> {
    const { data, error } = await this.supabase
      .from("patient_attachments")
      .select("*")
      .eq("id", params.attachmentId)
      .eq("patient_id", params.patientId)
      .eq("psychologist_id", params.psychologistId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PatientAttachment | null;
  }

  async create(params: {
    patientId: string;
    psychologistId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    fileType: string;
    visibility: AttachmentVisibility;
    now: string;
  }): Promise<PatientAttachment> {
    const { data, error } = await this.supabase
      .from("patient_attachments")
      .insert({
        patient_id: params.patientId,
        psychologist_id: params.psychologistId,
        file_name: params.fileName,
        file_path: params.filePath,
        file_size: params.fileSize,
        file_type: params.fileType,
        visibility: params.visibility,
        uploaded_by: "psychologist",
        created_at: params.now,
        updated_at: params.now,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as PatientAttachment;
  }

  async deleteById(params: {
    attachmentId: string;
    patientId: string;
    psychologistId: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("patient_attachments")
      .delete()
      .eq("id", params.attachmentId)
      .eq("patient_id", params.patientId)
      .eq("psychologist_id", params.psychologistId);

    if (error) {
      throw error;
    }
  }
}