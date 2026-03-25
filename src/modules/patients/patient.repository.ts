import { SupabaseClient } from '@supabase/supabase-js';
import { CreatePatientInput, UpdatePatientInput } from './patient.types';

export class PatientRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByPsychologist(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('patients')
      .select('*')
      .eq('psychologist_id', psychologistId)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByIdAndPsychologist(id: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async countByPsychologist(psychologistId: string) {
    const { count, error } = await this.supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('psychologist_id', psychologistId);

    if (error) throw error;
    return count ?? 0;
  }

  async getSubscriptionTier(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.subscription_tier ?? 'free';
  }

  async create(psychologistId: string, payload: CreatePatientInput) {
    const { data, error } = await this.supabase
      .from('patients')
      .insert({
        ...payload,
        psychologist_id: psychologistId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, psychologistId: string, payload: UpdatePatientInput) {
    const { data, error } = await this.supabase
      .from('patients')
      .update(payload)
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  private async safeDelete(table: string, column: string, value: string | string[]) {
    const query = this.supabase.from(table).delete();
    const result = Array.isArray(value)
      ? await query.in(column, value)
      : await query.eq(column, value);

    if (result.error) {
      throw new Error(
        `Falha ao deletar de '${table}' (${column}=${Array.isArray(value) ? '[...]' : value}): ${result.error.message} [code: ${result.error.code}]`
      );
    }
  }

  async deletePatientCascade(patientId: string) {
    // Get all session IDs for this patient to delete AI analyses
    const { data: sessions, error: sessionsQueryError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('patient_id', patientId);

    if (sessionsQueryError) {
      throw new Error(`Falha ao buscar sessions do paciente: ${sessionsQueryError.message}`);
    }

    // Delete session AI analyses
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: { id: string }) => s.id);
      await this.safeDelete('session_ai_analysis', 'session_id', sessionIds);
    }

    // Delete sessions
    await this.safeDelete('sessions', 'patient_id', patientId);

    // Delete patient access
    await this.safeDelete('patient_access', 'patient_id', patientId);

    // Delete patient attachments
    await this.safeDelete('patient_attachments', 'patient_id', patientId);

    // Get all treatment plan IDs to delete goals
    const { data: plans, error: plansQueryError } = await this.supabase
      .from('treatment_plans')
      .select('id')
      .eq('patient_id', patientId);

    if (plansQueryError) {
      throw new Error(`Falha ao buscar treatment_plans do paciente: ${plansQueryError.message}`);
    }

    // Delete treatment goals
    if (plans && plans.length > 0) {
      const planIds = plans.map((p: { id: string }) => p.id);
      await this.safeDelete('treatment_goals', 'treatment_plan_id', planIds);
    }

    // Delete treatment plans
    await this.safeDelete('treatment_plans', 'patient_id', patientId);

    // Delete patient diary logs
    await this.safeDelete('patient_logs', 'patient_id', patientId);

    // Delete patient diary prompts
    await this.safeDelete('patient_log_prompts', 'patient_id', patientId);

    // Delete patient AI analyses
    await this.safeDelete('patient_ai_analyses', 'patient_id', patientId);

    // Finally delete the patient
    await this.safeDelete('patients', 'id', patientId);
  }
}
