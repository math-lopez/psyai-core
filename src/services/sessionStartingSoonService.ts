import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationService } from './notificationService';

export class SessionStartingSoonService {
  private readonly notifications: NotificationService;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly log: { info: (msg: string) => void; error: (obj: object, msg: string) => void },
  ) {
    this.notifications = new NotificationService(supabase);
  }

  async sendUpcomingNotifications(): Promise<void> {
    const now = new Date();
    // Janela: sessões que começam entre 10 e 20 minutos a partir de agora
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

    const { data: sessions, error } = await this.supabase
      .from('sessions')
      .select('id, psychologist_id, session_date, patient:patients(full_name)')
      .in('processing_status', ['appointment', 'draft'])
      .neq('status', 'cancelled')
      .gte('session_date', windowStart)
      .lte('session_date', windowEnd);

    if (error) {
      this.log.error({ err: error }, '[session-soon] Erro ao buscar sessões próximas');
      return;
    }

    if (!sessions || sessions.length === 0) return;

    this.log.info(`[session-soon] ${sessions.length} sessão(ões) começando em ~15 min`);

    for (const session of sessions) {
      const patientName = (session.patient as any)?.full_name ?? 'Paciente';
      // O unique index na tabela notifications garante que só insere uma vez por sessão
      await this.notifications.sessionStartingSoon(
        session.psychologist_id,
        session.id,
        patientName,
        session.session_date,
      );
    }
  }
}
