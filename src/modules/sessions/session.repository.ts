import { SupabaseClient } from '@supabase/supabase-js';
import { CreateSessionInput, UpdateSessionInput } from './session.types';

interface SessionRow {
  patient_id: string;
  session_date: string;
  psychologist_id: string;
  processing_status: string;
  duration_minutes?: number;
  record_type?: string | null;
  manual_notes?: string | null;
  additional_notes?: string | null;
  clinical_notes?: string | null;
  interventions?: string | null;
  session_summary_manual?: string | null;
  next_steps?: string | null;
}

export class SessionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async countPatientsByPsychologist(psychologistId: string) {
    const { count, error } = await this.supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', psychologistId);

    if (error) throw error;
    return count ?? 0;
  }

  async listSessionsByPsychologist(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(`
        *,
        patient:patients(full_name)
      `)
      .eq('psychologist_id', psychologistId)
      .order('session_date', { ascending: false });

    if (error) throw error;
    return data;
  }

  async countSessionsByPsychologist(psychologistId: string) {
    const { count, error } = await this.supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', psychologistId);

    if (error) throw error;
    return count ?? 0;
  }

  async listSessionStatusesByPsychologist(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('id, processing_status')
      .eq('psychologist_id', psychologistId);

    if (error) throw error;
    return data ?? [];
  }

  async findByIdAndPsychologist(id: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(`
        *,
        patient:patients(full_name)
      `)
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findRawByIdAndPsychologist(id: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async patientBelongsToPsychologist(patientId: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async create(psychologistId: string, payload: CreateSessionInput) {
    const { data, error } = await this.supabase
      .from('sessions')
      .insert({
        ...payload,
        psychologist_id: psychologistId,
        processing_status: 'draft',
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, psychologistId: string, payload: UpdateSessionInput) {
    const { data, error } = await this.supabase
      .from('sessions')
      .update(payload)
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async delete(id: string, psychologistId: string) {
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('psychologist_id', psychologistId);

    if (error) throw error;
  }

  async listSessionsByPatient(patientId: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(`*, patient:patients(full_name)`)
      .eq('patient_id', patientId)
      .eq('psychologist_id', psychologistId)
      .order('session_date', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createMany(rows: SessionRow[]) {
    const { data, error } = await this.supabase
      .from('sessions')
      .insert(rows)
      .select('*');

    if (error) throw error;
    return data;
  }

  async getSessionAIAnalysis(sessionId: string) {
    const { data, error } = await this.supabase
      .from('session_ai_analysis')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}