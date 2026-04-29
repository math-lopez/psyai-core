import { SupabaseClient } from '@supabase/supabase-js';
import { SessionRepository } from '../modules/sessions/session.repository';
import { sendSessionReminderEmail } from './emailService';

function currentHourInBrasilia(): number {
  return parseInt(
    new Intl.DateTimeFormat('pt-BR', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
    10,
  );
}

export class ReminderService {
  private readonly repository: SessionRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: object, msg: string) => void }
  ) {
    this.repository = new SessionRepository(supabase);
  }

  async sendScheduledReminders() {
    const currentHour = currentHourInBrasilia();
    const allEnabled = await this.repository.findPsychologistsWithReminderEnabled();

    // Filtra apenas os psicólogos cujo horário configurado bate com a hora atual
    const duNow = allEnabled.filter((p) => (p.reminder_time ?? 8) === currentHour);

    if (duNow.length === 0) {
      this.log.info(`[reminder] Nenhum lembrete agendado para ${currentHour}h`);
      return;
    }

    this.log.info(`[reminder] ${duNow.length} psicólogo(s) com lembrete às ${currentHour}h`);

    // Agrupa por quantidade de dias de antecedência
    const grouped = new Map<number, string[]>();
    for (const p of duNow) {
      const days = p.reminder_days_before ?? 1;
      if (!grouped.has(days)) grouped.set(days, []);
      grouped.get(days)!.push(p.id);
    }

    for (const [daysBefore, psychIds] of grouped.entries()) {
      const sessions = await this.repository.findSessionsNeedingReminder(daysBefore, psychIds);

      this.log.info(`[reminder] ${sessions.length} sessão(ões) com ${daysBefore}d de antecedência`);

      for (const session of sessions) {
        try {
          const patient = session.patient;

          if (!patient?.email) {
            this.log.warn(`[reminder] Sessão ${session.id} sem email de paciente, pulando`);
            continue;
          }

          const psychologistName = await this.repository.findPsychologistNameById(session.psychologist_id);

          await sendSessionReminderEmail({
            patientName: patient.full_name,
            patientEmail: patient.email,
            psychologistName: psychologistName || 'seu psicólogo',
            sessionDate: session.session_date,
          });

          await this.repository.markReminderSent(session.id);

          this.log.info(`[reminder] Lembrete enviado para ${patient.email} — sessão ${session.id}`);
        } catch (err) {
          this.log.error({ err, sessionId: session.id }, '[reminder] Falha ao enviar lembrete');
        }
      }
    }
  }
}
