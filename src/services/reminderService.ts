import { SupabaseClient } from '@supabase/supabase-js';
import { SessionRepository } from '../modules/sessions/session.repository';
import { sendSessionReminderEmail } from './emailService';
import { sendWhatsAppReminder, sendWhatsAppHourReminder } from './twilioService';

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

  async sendHourReminders() {
    const allEnabled = await this.repository.findPsychologistsWithHourReminderEnabled();

    if (allEnabled.length === 0) {
      this.log.info('[reminder-1h] Nenhum psicólogo com lembrete de 1h ativado');
      return;
    }

    const psychIds = allEnabled.map((p) => p.id);
    const psychSettingsMap = new Map(allEnabled.map((p) => [p.id, p]));
    const sessions = await this.repository.findSessionsNeedingHourReminder(psychIds);

    this.log.info(`[reminder-1h] ${sessions.length} sessão(ões) na próxima hora`);

    for (const session of sessions) {
      try {
        const patient = session.patient;
        const psychSettings = psychSettingsMap.get(session.psychologist_id);

        if (!patient?.phone) {
          this.log.warn(`[reminder-1h] Sessão ${session.id} sem telefone de paciente, pulando`);
          await this.repository.markHourReminderSent(session.id);
          continue;
        }

        const psychologistName = await this.repository.findPsychologistNameById(session.psychologist_id);

        if (psychSettings?.whatsapp_reminder_enabled && psychSettings.subscription_tier === 'pro') {
          await sendWhatsAppHourReminder({
            patientName: patient.full_name,
            patientPhone: patient.phone,
            psychologistName: psychologistName || 'seu psicólogo',
            sessionDate: session.session_date,
          });
        }

        await this.repository.markHourReminderSent(session.id);
        this.log.info(`[reminder-1h] Lembrete 1h enviado para sessão ${session.id}`);
      } catch (err) {
        this.log.error({ err, sessionId: session.id }, '[reminder-1h] Falha ao enviar lembrete de 1h');
      }
    }
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

    // Mapa de psicólogo → configurações para consulta rápida de whatsapp_reminder_enabled
    const psychSettingsMap = new Map(duNow.map((p) => [p.id, p]));

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
          const psychSettings = psychSettingsMap.get(session.psychologist_id);

          if (!patient?.email) {
            this.log.warn(`[reminder] Sessão ${session.id} sem email de paciente, pulando`);
            continue;
          }

          const psychologistName = await this.repository.findPsychologistNameById(session.psychologist_id);
          const psyName = psychologistName || 'seu psicólogo';

          await sendSessionReminderEmail({
            patientName: patient.full_name,
            patientEmail: patient.email,
            psychologistName: psyName,
            sessionDate: session.session_date,
          });

          if (psychSettings?.whatsapp_reminder_enabled && psychSettings.subscription_tier === 'pro' && patient.phone) {
            try {
              await sendWhatsAppReminder({
                patientName: patient.full_name,
                patientPhone: patient.phone,
                psychologistName: psyName,
                sessionDate: session.session_date,
              });
              this.log.info(`[reminder] WhatsApp enviado para sessão ${session.id}`);
            } catch (wErr) {
              this.log.error({ err: wErr, sessionId: session.id }, '[reminder] Falha ao enviar WhatsApp (email já enviado)');
            }
          }

          await this.repository.markReminderSent(session.id);

          this.log.info(`[reminder] Lembrete enviado para ${patient.email} — sessão ${session.id}`);
        } catch (err) {
          this.log.error({ err, sessionId: session.id }, '[reminder] Falha ao enviar lembrete');
        }
      }
    }
  }
}
