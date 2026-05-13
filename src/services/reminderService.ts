import { SupabaseClient } from '@supabase/supabase-js';
import { SessionRepository } from '../modules/sessions/session.repository';
import { sendSessionReminderEmail } from './emailService';
import { sendWhatsAppReminder } from './whatsappService';

export class ReminderService {
  private readonly repository: SessionRepository;

  constructor(
    supabase: SupabaseClient,
    private readonly log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: object, msg: string) => void }
  ) {
    this.repository = new SessionRepository(supabase);
  }

  async sendReminders() {
    const allEnabled = await this.repository.findPsychologistsWithReminderEnabled();

    if (allEnabled.length === 0) {
      this.log.info('[reminder] Nenhum psicólogo com lembrete ativado');
      return;
    }

    const psychIds = allEnabled.map((p) => p.id);
    const psychSettingsMap = new Map(allEnabled.map((p) => [p.id, p]));
    const sessions = await this.repository.findSessionsNeedingReminder(1, psychIds);

    this.log.info(`[reminder] ${sessions.length} sessão(ões) com lembrete de 24h`);

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

        const backendUrl = process.env.BACKEND_URL || 'https://api.psiai.com.br';
        const tokens = await this.repository.createActionTokens(session.id, session.session_date);
        const actionUrls = {
          confirm:    `${backendUrl}/v1/public/session-action?token=${tokens.confirm}`,
          absent:     `${backendUrl}/v1/public/session-action?token=${tokens.absent}`,
          reschedule: `${backendUrl}/v1/public/session-action?token=${tokens.reschedule}`,
        };

        await sendSessionReminderEmail({
          patientName: patient.full_name,
          patientEmail: patient.email,
          psychologistName: psyName,
          sessionDate: session.session_date,
          actionUrls,
        });

        if (psychSettings?.whatsapp_reminder_enabled && patient.phone) {
          try {
            await sendWhatsAppReminder({
              patientName: patient.full_name,
              patientPhone: patient.phone,
              psychologistName: psyName,
              sessionDate: session.session_date,
              sessionId: session.id,
              psychologistPhone: psychSettings.phone ?? null,
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
