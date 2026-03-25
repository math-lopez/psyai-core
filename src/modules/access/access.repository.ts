import { SupabaseClient } from "@supabase/supabase-js";
import { PatientAccess, AccessStatus } from "./access.types";

export class AccessRepository {
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

  async findByPatientId(patientId: string): Promise<PatientAccess | null> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .select("*")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PatientAccess | null;
  }

  async upsertInvite(params: {
    patientId: string;
    psychologistId: string;
    inviteToken: string;
    now: string;
  }): Promise<PatientAccess> {
    const payload = {
      patient_id: params.patientId,
      psychologist_id: params.psychologistId,
      status: "invited",
      invite_token: params.inviteToken,
      invited_at: params.now,
      updated_at: params.now,
      revoked_at: null,
      suspended_at: null,
      accepted_at: null,
    };

    const { data, error } = await this.supabase
      .from("patient_access")
      .upsert(payload, { onConflict: "patient_id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as PatientAccess;
  }

  async updateStatus(params: {
    patientId: string;
    psychologistId: string;
    status: AccessStatus;
    now: string;
  }): Promise<PatientAccess> {
    const updatePayload: Record<string, string | null> = {
      status: params.status,
      updated_at: params.now,
    };

    if (params.status === "active") {
      updatePayload.accepted_at = params.now;
      updatePayload.suspended_at = null;
      updatePayload.revoked_at = null;
    }

    if (params.status === "suspended") {
      updatePayload.suspended_at = params.now;
    }

    if (params.status === "revoked") {
      updatePayload.revoked_at = params.now;
    }

    if (params.status === "invited") {
      updatePayload.accepted_at = null;
      updatePayload.suspended_at = null;
      updatePayload.revoked_at = null;
    }

    const { data, error } = await this.supabase
      .from("patient_access")
      .update(updatePayload)
      .eq("patient_id", params.patientId)
      .eq("psychologist_id", params.psychologistId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as PatientAccess;
  }

  async revokeAccess(params: {
    patientId: string;
    psychologistId: string;
    now: string;
  }): Promise<PatientAccess> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .update({
        status: "suspended",
        updated_at: params.now,
        suspended_at: params.now,
      })
      .eq("patient_id", params.patientId)
      .eq("psychologist_id", params.psychologistId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as PatientAccess;
  }
}