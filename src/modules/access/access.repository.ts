import { SupabaseClient } from "@supabase/supabase-js";
import { PatientAccess, AccessStatus } from "./access.types";

const INVITE_EXPIRY_DAYS = 7;

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

  async findByPatientAndPsychologist(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAccess | null> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .select("*")
      .eq("patient_id", patientId)
      .eq("psychologist_id", psychologistId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PatientAccess | null;
  }

  async findByToken(token: string): Promise<PatientAccess | null> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .select("*")
      .eq("invite_token", token)
      .maybeSingle();

    if (error) throw error;
    return data as PatientAccess | null;
  }

  async findByCode(code: string): Promise<PatientAccess | null> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .select("*")
      .eq("invite_code", code)
      .maybeSingle();

    if (error) throw error;
    return data as PatientAccess | null;
  }

  async activateAccess(params: {
    id: string;
    userId: string;
    now: string;
  }): Promise<PatientAccess> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .update({
        user_id: params.userId,
        status: "active",
        accepted_at: params.now,
        updated_at: params.now,
        invite_token: null,
        invite_code: null,
        invite_expires_at: null,
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;
    return data as PatientAccess;
  }

  async upsertInvite(params: {
    patientId: string;
    psychologistId: string;
    inviteToken: string;
    inviteCode: string;
    now: string;
  }): Promise<PatientAccess> {
    const expiresAt = new Date(
      new Date(params.now).getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const payload = {
      patient_id: params.patientId,
      psychologist_id: params.psychologistId,
      status: "invited",
      invite_token: params.inviteToken,
      invite_code: params.inviteCode,
      invite_expires_at: expiresAt,
      invited_at: params.now,
      updated_at: params.now,
      revoked_at: null,
      suspended_at: null,
      accepted_at: null,
      user_id: null,
    };

    const { data, error } = await this.supabase
      .from("patient_access")
      .upsert(payload, { onConflict: "patient_id,psychologist_id" })
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