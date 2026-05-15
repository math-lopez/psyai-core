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
      .select(`*, patient:patients(full_name)`)
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
      .select(`*, patient:patients(full_name)`)
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

  async findPatientById(patientId: string) {
    const { data, error } = await this.supabase
      .from('patients')
      .select('full_name, email, phone')
      .eq('id', patientId)
      .maybeSingle();

    if (error) throw error;
    return data as { full_name: string; email: string; phone: string | null } | null;
  }

  async findPsychologistNameById(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('full_name')
      .eq('id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return data?.full_name as string | null;
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
        processing_status: 'appointment',
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

  async getSubscriptionTier(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.subscription_tier ?? 'free';
  }

  async countSessionsInMonth(psychologistId: string, year: number, month: number) {
    const firstDay = new Date(year, month, 1).toISOString();
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { count, error } = await this.supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', psychologistId)
      .neq('status', 'cancelled')
      .gte('session_date', firstDay)
      .lte('session_date', lastDay);

    if (error) throw error;
    return count ?? 0;
  }

  async countVideoCallsThisMonth(psychologistId: string) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count, error } = await this.supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', psychologistId)
      .in('video_status', ['waiting', 'active', 'ended'])
      .gte('created_at', firstDay)
      .lte('created_at', lastDay);

    if (error) throw error;
    return count ?? 0;
  }

  async countTranscriptionsThisMonth(psychologistId: string) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count, error } = await this.supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', psychologistId)
      .not('audio_file_path', 'is', null)
      .in('processing_status', ['queued', 'processing', 'completed'])
      .gte('created_at', firstDay)
      .lte('created_at', lastDay);

    if (error) throw error;
    return count ?? 0;
  }

  async findPsychologistsWithReminderEnabled() {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, reminder_days_before, reminder_time, whatsapp_reminder_enabled, phone')
      .eq('reminder_enabled', true);

    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      reminder_days_before: number;
      reminder_time: number;
      whatsapp_reminder_enabled: boolean;
      phone: string | null;
    }>;
  }

  async findPsychologistsWithHourReminderEnabled() {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, whatsapp_reminder_enabled')
      .eq('hour_reminder_enabled', true);

    if (error) throw error;
    return (data ?? []) as Array<{ id: string; whatsapp_reminder_enabled: boolean }>;
  }

  async findSessionsNeedingHourReminder(psychologistIds: string[]) {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('sessions')
      .select('id, session_date, psychologist_id, patient:patients(full_name, email, phone)')
      .in('psychologist_id', psychologistIds)
      .neq('status', 'cancelled')
      .is('hour_reminder_sent_at', null)
      .gte('session_date', now.toISOString())
      .lte('session_date', inOneHour.toISOString());

    if (error) throw error;
    return (data ?? []) as unknown as Array<{
      id: string;
      session_date: string;
      psychologist_id: string;
      patient: { full_name: string; email: string; phone: string | null } | null;
    }>;
  }

  async markHourReminderSent(sessionId: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ hour_reminder_sent_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async findSessionsNeedingReminder(daysBefore: number, psychologistIds: string[]) {
    const target = new Date();
    target.setDate(target.getDate() + daysBefore);
    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0).toISOString();
    const end = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59).toISOString();

    const { data, error } = await this.supabase
      .from('sessions')
      .select('id, session_date, psychologist_id, patient:patients(full_name, email, phone)')
      .in('psychologist_id', psychologistIds)
      .neq('status', 'cancelled')
      .is('reminder_sent_at', null)
      .gte('session_date', start)
      .lte('session_date', end);

    if (error) throw error;
    return (data ?? []) as unknown as Array<{
      id: string;
      session_date: string;
      psychologist_id: string;
      patient: { full_name: string; email: string; phone: string | null } | null;
    }>;
  }

  async markReminderSent(sessionId: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
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

  // ── Session action tokens ────────────────────────────────────────────────

  async createActionTokens(sessionId: string, sessionDate: string): Promise<{ confirm: string; absent: string; reschedule: string }> {
    const expiresAt = new Date(sessionDate);
    expiresAt.setHours(expiresAt.getHours() + 2); // expira 2h após a sessão

    const rows = [
      { session_id: sessionId, action: 'confirm',    expires_at: expiresAt.toISOString() },
      { session_id: sessionId, action: 'absent',     expires_at: expiresAt.toISOString() },
      { session_id: sessionId, action: 'reschedule', expires_at: expiresAt.toISOString() },
    ];

    const { data, error } = await this.supabase
      .from('session_action_tokens')
      .insert(rows)
      .select('token, action');

    if (error) throw error;

    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.action] = row.token;

    return { confirm: map['confirm'], absent: map['absent'], reschedule: map['reschedule'] };
  }

  async findActionToken(token: string) {
    const { data, error } = await this.supabase
      .from('session_action_tokens')
      .select('id, session_id, action, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data as { id: string; session_id: string; action: string; expires_at: string; used_at: string | null } | null;
  }

  async markTokenUsed(tokenId: string) {
    const { error } = await this.supabase
      .from('session_action_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (error) throw error;
  }

  // ── Session action data ──────────────────────────────────────────────────

  async findSessionForAction(sessionId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(`
        id, session_date, psychologist_id, patient_id, patient_status, status,
        patient:patients(full_name, email, phone),
        psychologist:profiles!sessions_psychologist_id_fkey(full_name, phone, whatsapp_reminder_enabled)
      `)
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data as {
      id: string;
      session_date: string;
      psychologist_id: string;
      patient_id: string;
      patient_status: string | null;
      status: string;
      patient: { full_name: string; email: string; phone: string | null } | null;
      psychologist: { full_name: string; phone: string | null; whatsapp_reminder_enabled: boolean } | null;
    } | null;
  }

  async updatePatientStatus(sessionId: string, status: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ patient_status: status })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async updateSessionDate(sessionId: string, newDate: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ session_date: newDate })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async resetReminderFlags(sessionId: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ reminder_sent_at: null, hour_reminder_sent_at: null })
      .eq('id', sessionId);

    if (error) throw error;
  }

  // ── Reschedule requests ──────────────────────────────────────────────────

  async createRescheduleRequest(sessionId: string, psychologistId: string): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('session_reschedule_requests')
      .insert({ session_id: sessionId, psychologist_id: psychologistId })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async findRescheduleRequestById(requestId: string) {
    const { data, error } = await this.supabase
      .from('session_reschedule_requests')
      .select('id, session_id, psychologist_id, status, new_session_date, created_at')
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    return data as {
      id: string;
      session_id: string;
      psychologist_id: string;
      status: string;
      new_session_date: string | null;
      created_at: string;
    } | null;
  }

  async updateRescheduleRequest(requestId: string, status: string, newSessionDate?: string) {
    const { error } = await this.supabase
      .from('session_reschedule_requests')
      .update({ status, new_session_date: newSessionDate ?? null, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw error;
  }

  async listPendingRescheduleRequests(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('session_reschedule_requests')
      .select(`
        id, session_id, status, created_at,
        session:sessions(session_date, patient:patients(full_name))
      `)
      .eq('psychologist_id', psychologistId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
