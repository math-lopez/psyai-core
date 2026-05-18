import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export type NotificationEventType =
  | 'session_confirmed'
  | 'session_absent'
  | 'reschedule_requested'
  | 'session_processing_done'
  | 'session_processing_error'
  | 'session_starting_soon'
  | 'financial_reminder';

interface CreateNotificationInput {
  psychologist_id: string;
  type: NotificationType;
  event_type: NotificationEventType;
  title: string;
  message: string;
  href?: string;
  metadata?: Record<string, string | number | boolean>;
}

export class NotificationService {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateNotificationInput): Promise<void> {
    const { error } = await this.supabase.from('notifications').insert(input);
    if (error) {
      console.error('[notifications] Falha ao inserir notificação:', error.message, input);
    }
  }

  async sessionConfirmed(psychologistId: string, patientName: string, sessionDate: string): Promise<void> {
    await this.create({
      psychologist_id: psychologistId,
      type: 'success',
      event_type: 'session_confirmed',
      title: 'Sessão confirmada',
      message: `${patientName} confirmou presença na sessão de ${formatDate(sessionDate)}.`,
      href: '/agenda',
    });
  }

  async sessionAbsent(psychologistId: string, patientName: string, sessionDate: string): Promise<void> {
    await this.create({
      psychologist_id: psychologistId,
      type: 'warning',
      event_type: 'session_absent',
      title: 'Ausência registrada',
      message: `${patientName} informou que não poderá comparecer à sessão de ${formatDate(sessionDate)}.`,
      href: '/agenda',
    });
  }

  async rescheduleRequested(psychologistId: string, patientName: string, sessionDate: string): Promise<void> {
    await this.create({
      psychologist_id: psychologistId,
      type: 'info',
      event_type: 'reschedule_requested',
      title: 'Pedido de reagendamento',
      message: `${patientName} solicitou o reagendamento da sessão de ${formatDate(sessionDate)}.`,
      href: '/sessoes',
    });
  }

  async sessionProcessingDone(psychologistId: string, sessionId: string): Promise<void> {
    await this.create({
      psychologist_id: psychologistId,
      type: 'success',
      event_type: 'session_processing_done',
      title: 'Transcrição concluída',
      message: 'A transcrição e análise da sua sessão estão prontas.',
      href: `/sessoes/${sessionId}`,
      metadata: { session_id: sessionId },
    });
  }

  async sessionStartingSoon(psychologistId: string, sessionId: string, patientName: string, sessionDate: string): Promise<void> {
    await this.create({
      psychologist_id: psychologistId,
      type: 'info',
      event_type: 'session_starting_soon',
      title: 'Sessão em breve',
      message: `Sua sessão com ${patientName} começa às ${formatTime(sessionDate)}.`,
      href: '/agenda',
      metadata: { session_id: sessionId },
    });
  }

  async financialReminder(psychologistId: string, count: number, monthLabel: string): Promise<void> {
    await this.create({
      psychologist_id: psychologistId,
      type: 'warning',
      event_type: 'financial_reminder',
      title: 'Sessões sem cobrança',
      message: `${count} sessão(ões) de ${monthLabel} concluída(s) sem cobrança vinculada.`,
      href: '/financeiro',
    });
  }
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}
