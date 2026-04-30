import { SupabaseClient } from '@supabase/supabase-js';
import { CreateTemplateInput, CreateApplicationInput, ScoringConfig } from './test.types';

export class TestRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // ── Templates ───────────────────────────────────────────────────────────────

  async listTemplates(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('test_templates')
      .select('id, name, description, created_at')
      .eq('psychologist_id', psychologistId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async findTemplateById(id: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('test_templates')
      .select('*, questions:test_questions(*)')
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findTemplateByIdPublic(id: string) {
    const { data, error } = await this.supabase
      .from('test_templates')
      .select('id, name, instructions, scoring_config, questions:test_questions(id, order_index, text, type, options)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createTemplate(psychologistId: string, input: CreateTemplateInput) {
    const { questions, ...templateFields } = input;

    const { data: template, error: tErr } = await this.supabase
      .from('test_templates')
      .insert({ ...templateFields, psychologist_id: psychologistId })
      .select('*')
      .single();

    if (tErr) throw tErr;

    const questionRows = questions.map((q) => ({ ...q, template_id: template.id }));
    const { error: qErr } = await this.supabase.from('test_questions').insert(questionRows);
    if (qErr) throw qErr;

    return template;
  }

  async deleteTemplate(id: string, psychologistId: string) {
    const { error } = await this.supabase
      .from('test_templates')
      .delete()
      .eq('id', id)
      .eq('psychologist_id', psychologistId);

    if (error) throw error;
  }

  // ── Applications ────────────────────────────────────────────────────────────

  async createApplication(psychologistId: string, input: CreateApplicationInput) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (input.expires_in_days ?? 7));

    const { data, error } = await this.supabase
      .from('test_applications')
      .insert({
        template_id: input.template_id,
        patient_id: input.patient_id,
        session_id: input.session_id ?? null,
        psychologist_id: psychologistId,
        expires_at: expiresAt.toISOString(),
      })
      .select('*, template:test_templates(name)')
      .single();

    if (error) throw error;
    return data;
  }

  async listApplicationsByPatient(patientId: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('test_applications')
      .select('id, status, created_at, completed_at, result, expires_at, template:test_templates(name, description, scoring_config)')
      .eq('patient_id', patientId)
      .eq('psychologist_id', psychologistId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  // ── Public (patient) ────────────────────────────────────────────────────────

  async findApplicationByToken(token: string) {
    const { data, error } = await this.supabase
      .from('test_applications')
      .select('*, patient:patients(full_name), template:test_templates(id, name, instructions, scoring_config, questions:test_questions(id, order_index, text, type, options))')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async submitResponses(
    applicationId: string,
    responses: Array<{ question_id: string; answer: unknown; score: number }>,
    result: Record<string, unknown>,
  ) {
    const { error: rErr } = await this.supabase
      .from('test_responses')
      .insert(responses.map((r) => ({ ...r, application_id: applicationId })));

    if (rErr) throw rErr;

    const { error: aErr } = await this.supabase
      .from('test_applications')
      .update({ status: 'completed', completed_at: new Date().toISOString(), result })
      .eq('id', applicationId);

    if (aErr) throw aErr;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async findPatientById(patientId: string) {
    const { data, error } = await this.supabase
      .from('patients')
      .select('full_name, email')
      .eq('id', patientId)
      .maybeSingle();

    if (error) throw error;
    return data as { full_name: string; email: string } | null;
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
}
