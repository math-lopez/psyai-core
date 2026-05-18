import { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendPendingFinancialReminderEmail } from './emailService';

type Log = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (obj: object, msg: string) => void;
};

export class FinancialReminderService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly log: Log,
  ) {}

  async sendMonthlyReminders() {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const monthLabel     = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });

    const { data: sessions, error } = await this.supabase
      .from('sessions')
      .select('psychologist_id, patient:patients(full_name)')
      .eq('status', 'completed')
      .is('charge_id', null)
      .gte('session_date', prevMonthStart)
      .lte('session_date', prevMonthEnd);

    if (error) {
      this.log.error({ err: error }, '[financial-reminder] Erro ao buscar sessões sem cobrança');
      return;
    }

    if (!sessions || sessions.length === 0) {
      this.log.info('[financial-reminder] Nenhuma sessão sem cobrança no mês anterior');
      return;
    }

    // Agrupa por psicólogo
    const byPsychologist = new Map<string, Map<string, number>>();
    for (const s of sessions) {
      const patientName = (s.patient as any)?.full_name ?? 'Paciente';
      if (!byPsychologist.has(s.psychologist_id)) {
        byPsychologist.set(s.psychologist_id, new Map());
      }
      const patients = byPsychologist.get(s.psychologist_id)!;
      patients.set(patientName, (patients.get(patientName) ?? 0) + 1);
    }

    this.log.info(`[financial-reminder] ${byPsychologist.size} psicólogo(s) com sessões sem cobrança em ${monthLabel}`);

    for (const [psychologistId, patientsMap] of byPsychologist) {
      try {
        const { data: { user } } = await this.supabase.auth.admin.getUserById(psychologistId);
        if (!user?.email) {
          this.log.warn(`[financial-reminder] Email não encontrado para psicólogo ${psychologistId}, pulando`);
          continue;
        }

        const { data: profile } = await this.supabase
          .from('profiles')
          .select('full_name')
          .eq('id', psychologistId)
          .maybeSingle();

        const psychologistName = profile?.full_name ?? 'Psicólogo(a)';
        const patients = Array.from(patientsMap.entries()).map(([name, sessionCount]) => ({ name, sessionCount }));

        await sendPendingFinancialReminderEmail({
          psychologistName,
          psychologistEmail: user.email,
          monthLabel,
          patients,
        });

        this.log.info(`[financial-reminder] Email enviado para ${user.email} — ${patients.length} paciente(s)`);
      } catch (err) {
        this.log.error({ err, psychologistId }, '[financial-reminder] Falha ao enviar lembrete para psicólogo');
      }
    }
  }
}
