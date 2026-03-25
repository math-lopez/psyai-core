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

  private async safeCascadeDelete(table: string, column: string, value: string | string[]) {
    const query = this.supabase.from(table).delete();
    const { error } = Array.isArray(value)
      ? await query.in(column, value)
      : await query.eq(column, value);

    if (error) {
      throw new Error(`Falha ao deletar '${table}' (${column}): ${error.message} [${error.code}]`);
    }
  }

  async deletePatientCascade(patientId: string) {
    // 1. Get session IDs for child-table cleanup
    const { data: sessions } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('patient_id', patientId);

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: { id: string }) => s.id);
      await this.safeCascadeDelete('session_ai_analysis', 'session_id', sessionIds);
    }

    // 2. Delete sessions
    await this.safeCascadeDelete('sessions', 'patient_id', patientId);

    // 3. Delete patient access
    await this.safeCascadeDelete('patient_access', 'patient_id', patientId);

    // 4. Delete patient attachments
    await this.safeCascadeDelete('patient_attachments', 'patient_id', patientId);

    // 5. Get treatment plan IDs for child-table cleanup
    const { data: plans } = await this.supabase
      .from('treatment_plans')
      .select('id')
      .eq('patient_id', patientId);

    if (plans && plans.length > 0) {
      const planIds = plans.map((p: { id: string }) => p.id);
      await this.safeCascadeDelete('treatment_goals', 'treatment_plan_id', planIds);
    }

    // 6. Delete treatment plans
    await this.safeCascadeDelete('treatment_plans', 'patient_id', patientId);

    // 7. Delete diary log attachments (before logs, since attachments reference logs)
    const { data: logs } = await this.supabase
      .from('patient_logs')
      .select('id')
      .eq('patient_id', patientId);

    if (logs && logs.length > 0) {
      const logIds = logs.map((l: { id: string }) => l.id);
      await this.safeCascadeDelete('patient_log_attachments', 'log_id', logIds);
    }

    // 8. Delete patient diary logs
    await this.safeCascadeDelete('patient_logs', 'patient_id', patientId);

    // 9. Delete patient diary prompts
    await this.safeCascadeDelete('patient_log_prompts', 'patient_id', patientId);

    // 10. Finally delete the patient
    await this.safeCascadeDelete('patients', 'id', patientId);
  }
}
