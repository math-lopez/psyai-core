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

  async deletePatientCascade(patientId: string) {
    // Get all session IDs for this patient to delete AI analyses
    const { data: sessions } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('patient_id', patientId);

    // Delete session AI analyses
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: { id: string }) => s.id);
      const { error: aiError } = await this.supabase
        .from('session_ai_analysis')
        .delete()
        .in('session_id', sessionIds);
      if (aiError) throw aiError;
    }

    // Delete sessions
    const { error: sessionsError } = await this.supabase
      .from('sessions')
      .delete()
      .eq('patient_id', patientId);
    if (sessionsError) throw sessionsError;

    // Delete patient access
    const { error: accessError } = await this.supabase
      .from('patient_access')
      .delete()
      .eq('patient_id', patientId);
    if (accessError) throw accessError;

    // Delete patient attachments
    const { error: attachmentsError } = await this.supabase
      .from('patient_attachments')
      .delete()
      .eq('patient_id', patientId);
    if (attachmentsError) throw attachmentsError;

    // Get all treatment plan IDs to delete goals
    const { data: plans } = await this.supabase
      .from('treatment_plans')
      .select('id')
      .eq('patient_id', patientId);

    // Delete treatment goals
    if (plans && plans.length > 0) {
      const planIds = plans.map((p: { id: string }) => p.id);
      const { error: goalsError } = await this.supabase
        .from('treatment_goals')
        .delete()
        .in('treatment_plan_id', planIds);
      if (goalsError) throw goalsError;
    }

    // Delete treatment plans
    const { error: plansError } = await this.supabase
      .from('treatment_plans')
      .delete()
      .eq('patient_id', patientId);
    if (plansError) throw plansError;

    // Delete patient diary logs
    const { error: logsError } = await this.supabase
      .from('patient_logs')
      .delete()
      .eq('patient_id', patientId);
    if (logsError) throw logsError;

    // Delete patient diary prompts
    const { error: promptsError } = await this.supabase
      .from('patient_log_prompts')
      .delete()
      .eq('patient_id', patientId);
    if (promptsError) throw promptsError;

    // Delete patient AI analyses
    const { error: analysesError } = await this.supabase
      .from('patient_ai_analyses')
      .delete()
      .eq('patient_id', patientId);
    if (analysesError) throw analysesError;

    // Finally delete the patient
    const { error: patientError } = await this.supabase
      .from('patients')
      .delete()
      .eq('id', patientId);
    if (patientError) throw patientError;
  }
}
