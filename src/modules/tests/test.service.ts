import { FastifyInstance } from 'fastify';
import { TestRepository } from './test.repository';
import { CreateTemplateInput, CreateApplicationInput, SubmitTestInput, ScoringConfig } from './test.types';
import { sendTestApplicationEmail } from '../../services/emailService';

function makeHttpError(statusCode: number, message: string) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

function calculateResult(
  scoringConfig: ScoringConfig,
  answers: Array<{ question_id: string; value: number | boolean }>,
  questions: Array<{ id: string; options: Array<{ value: number }> }>,
): { total: number; max: number; subscales?: Record<string, number>; label?: string } {
  const toScore = (v: number | boolean) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const scoreMap = new Map(answers.map((a) => [a.question_id, toScore(a.value)]));

  // Máximo possível: maior valor de opção × número de perguntas
  const maxPerQuestion = new Map(
    questions.map((q) => [q.id, q.options.length ? Math.max(...q.options.map((o) => o.value)) : 1]),
  );
  const maxTotal = [...maxPerQuestion.values()].reduce((a, b) => a + b, 0);

  const resolveLabel = (ranges: Array<{ min: number; max: number; label: string }> | undefined, value: number) =>
    ranges?.find((r) => value >= r.min && value <= r.max)?.label;

  if (scoringConfig.type === 'subscales') {
    const subscales: Record<string, number> = {};
    for (const sub of scoringConfig.subscales) {
      subscales[sub.name] = sub.question_ids.reduce((acc, qid) => acc + (scoreMap.get(qid) ?? 0), 0);
    }
    const total = Object.values(subscales).reduce((a, b) => a + b, 0);
    return { total, max: maxTotal, subscales, label: resolveLabel(scoringConfig.total_ranges, total) };
  }

  const scores = [...scoreMap.values()];
  const total = scoringConfig.type === 'average'
    ? scores.reduce((a, b) => a + b, 0) / (scores.length || 1)
    : scores.reduce((a, b) => a + b, 0);

  return { total, max: maxTotal, label: resolveLabel(scoringConfig.total_ranges, total) };
}

export class TestService {
  private readonly repository: TestRepository;

  constructor(private readonly app: FastifyInstance) {
    this.repository = new TestRepository(app.supabase);
  }

  // ── Templates ───────────────────────────────────────────────────────────────

  async listTemplates(psychologistId: string) {
    return this.repository.listTemplates(psychologistId);
  }

  async getTemplate(id: string, psychologistId: string) {
    const template = await this.repository.findTemplateById(id, psychologistId);
    if (!template) throw makeHttpError(404, 'Instrumento não encontrado');
    return template;
  }

  async createTemplate(psychologistId: string, input: CreateTemplateInput) {
    return this.repository.createTemplate(psychologistId, input);
  }

  async deleteTemplate(id: string, psychologistId: string) {
    const existing = await this.repository.findTemplateById(id, psychologistId);
    if (!existing) throw makeHttpError(404, 'Instrumento não encontrado');
    await this.repository.deleteTemplate(id, psychologistId);
    return { success: true };
  }

  // ── Applications ────────────────────────────────────────────────────────────

  async applyTest(psychologistId: string, input: CreateApplicationInput) {
    const application = await this.repository.createApplication(psychologistId, input);

    // Dispara email sem bloquear a resposta
    this.sendTestEmail(psychologistId, input.patient_id, application).catch((err) => {
      this.app.log.error({ err }, '[tests] Falha ao enviar email de instrumento');
    });

    return application;
  }

  private async sendTestEmail(psychologistId: string, patientId: string, application: any) {
    const [patient, psychologistName] = await Promise.all([
      this.repository.findPatientById(patientId),
      this.repository.findPsychologistNameById(psychologistId),
    ]);

    if (!patient?.email) return;

    const testUrl = `${process.env.FRONTEND_URL}/testes/${application.token}`;

    await sendTestApplicationEmail({
      patientName: patient.full_name,
      patientEmail: patient.email,
      psychologistName: psychologistName || 'seu psicólogo',
      testName: application.template?.name ?? 'Instrumento',
      testUrl,
    });
  }

  async listApplicationsByPatient(patientId: string, psychologistId: string) {
    return this.repository.listApplicationsByPatient(patientId, psychologistId);
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  async getTestByToken(token: string) {
    const application = await this.repository.findApplicationByToken(token);

    if (!application) throw makeHttpError(404, 'Teste não encontrado');
    if (application.status === 'completed') throw makeHttpError(410, 'Este teste já foi respondido');
    if (new Date(application.expires_at) < new Date()) {
      throw makeHttpError(410, 'O link deste teste expirou');
    }

    const { template } = application as any;
    const questions = [...(template?.questions ?? [])].sort(
      (a: any, b: any) => a.order_index - b.order_index,
    );

    return {
      patientName: (application as any).patient?.full_name,
      testName: template?.name,
      instructions: template?.instructions,
      questions,
    };
  }

  async submitTest(token: string, input: SubmitTestInput) {
    const application = await this.repository.findApplicationByToken(token);

    if (!application) throw makeHttpError(404, 'Teste não encontrado');
    if (application.status === 'completed') throw makeHttpError(410, 'Este teste já foi respondido');
    if (new Date(application.expires_at) < new Date()) {
      throw makeHttpError(410, 'O link deste teste expirou');
    }

    const scoringConfig = (application as any).template?.scoring_config as ScoringConfig;
    const questions = (application as any).template?.questions ?? [];
    const result = calculateResult(
      scoringConfig,
      input.answers.map((a) => ({ question_id: a.question_id, value: a.value as number | boolean })),
      questions,
    );

    const responses = input.answers.map((a) => ({
      question_id: a.question_id,
      answer: { value: a.value },
      score: typeof a.value === 'boolean' ? (a.value ? 1 : 0) : a.value,
    }));

    await this.repository.submitResponses(application.id, responses, result);

    return { success: true, result };
  }
}
