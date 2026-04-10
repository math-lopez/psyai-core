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

  async findAnyActiveByPatientEmail(patientId: string): Promise<PatientAccess | null> {
    // 1. Busca o email do paciente deste psicólogo
    const { data: patient, error: patientError } = await this.supabase
      .from("patients")
      .select("email")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient?.email) return null;

    // 2. Acha todos os patient_ids com este email (de qualquer psicólogo)
    const { data: sameEmailPatients, error: sameEmailError } = await this.supabase
      .from("patients")
      .select("id")
      .eq("email", patient.email);

    if (sameEmailError) throw sameEmailError;
    if (!sameEmailPatients?.length) return null;

    const patientIds = sameEmailPatients.map((p: { id: string }) => p.id);

    // 3. Verifica se algum desses patient_ids tem um patient_access ativo com user_id
    const { data, error } = await this.supabase
      .from("patient_access")
      .select("*")
      .in("patient_id", patientIds)
      .eq("status", "active")
      .not("user_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as PatientAccess | null;
  }

  async upsertActiveAccess(params: {
    patientId: string;
    psychologistId: string;
    userId: string;
    now: string;
  }): Promise<PatientAccess> {
    const { data, error } = await this.supabase
      .from("patient_access")
      .upsert(
        {
          patient_id: params.patientId,
          psychologist_id: params.psychologistId,
          user_id: params.userId,
          status: "active",
          accepted_at: params.now,
          updated_at: params.now,
          invited_at: null,
          invite_token: null,
          invite_code: null,
          invite_expires_at: null,
          revoked_at: null,
          suspended_at: null,
        },
        { onConflict: "patient_id,psychologist_id" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return data as PatientAccess;
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