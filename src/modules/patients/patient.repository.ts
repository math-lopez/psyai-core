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
}