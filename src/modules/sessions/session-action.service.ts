import { SupabaseClient } from '@supabase/supabase-js';
import { SessionRepository } from './session.repository';
import { ScheduleRepository, AvailableSlot, parseSlotRowId, compactDateToISO } from '../schedule/schedule.repository';
import {
  sendPatientConfirmedEmail,
  sendPatientAbsentEmail,
  sendPatientRescheduleRequestedEmail,
  sendPsychologistAbsenceNotificationEmail,
  sendPsychologistRescheduleNotificationEmail,
  sendPatientRescheduleApprovedEmail,
  sendPatientRescheduleRejectedEmail,
} from '../../services/emailService';
import {
  sendWhatsAppPatientConfirmed,
  sendWhatsAppPatientAbsent,
  sendWhatsAppPatientRescheduleRequested,
  sendWhatsAppPatientRescheduleApproved,
  sendWhatsAppPatientRescheduleRejected,
  sendWhatsAppRescheduleSlots,
  sendWhatsAppText,
} from '../../services/whatsappService';

export type EmailTokenResult =
  | { type: 'done'; action: string }
  | { type: 'redirect_slots'; token: string; slots: AvailableSlot[] }
  | { type: 'no_slots' }
  | null;

export class SessionActionService {
  private readonly sessions: SessionRepository;
  private readonly schedule: ScheduleRepository;

  constructor(private readonly supabase: SupabaseClient) {
    this.sessions = new SessionRepository(supabase);
    this.schedule = new ScheduleRepository(supabase);
  }

  // ── Email token flow ─────────────────────────────────────────────────────

  async processEmailToken(token: string): Promise<EmailTokenResult> {
    const record = await this.sessions.findActionToken(token);
    if (!record || record.used_at || new Date(record.expires_at) < new Date()) return null;

    if (record.action !== 'reschedule') {
      await this.sessions.markTokenUsed(record.id);
      await this.processConfirmOrAbsent(record.session_id, record.action);
      return { type: 'done', action: record.action };
    }

    // Reschedule: check mode
    const session = await this.sessions.findSessionForAction(record.session_id);
    if (!session) return null;

    const mode = await this.schedule.getRescheduleMode(session.psychologist_id);

    if (mode === 'manual') {
      await this.sessions.markTokenUsed(record.id);
      await this.handleManualReschedule(record.session_id, session);
      return { type: 'done', action: 'reschedule' };
    }

    // Automatic mode: calculate slots
    const [scheduleConfig, existingSessions] = await Promise.all([
      this.schedule.getSchedule(session.psychologist_id),
      this.schedule.getSessionsThisWeek(session.psychologist_id),
    ]);

    console.log(`[reschedule email] scheduleConfig days=${scheduleConfig.length} existingSessions=${existingSessions.length}`);
    const slots = this.schedule.computeAvailableSlots(scheduleConfig, existingSessions, record.session_id);
    console.log(`[reschedule email] slots computed=${slots.length}`);

    if (slots.length === 0) {
      // No slots — fall back to manual flow
      await this.sessions.markTokenUsed(record.id);
      await this.handleManualReschedule(record.session_id, session);
      return { type: 'no_slots' };
    }

    // Don't mark token as used yet — patient will submit the slot picker
    return { type: 'redirect_slots', token, slots };
  }

  async processEmailSlotProposal(token: string, proposedDate: string): Promise<boolean> {
    const record = await this.sessions.findActionToken(token);
    if (!record || record.used_at || record.action !== 'reschedule' || new Date(record.expires_at) < new Date()) {
      return false;
    }

    await this.sessions.markTokenUsed(record.id);
    await this.createRescheduleRequestWithDate(record.session_id, proposedDate);
    return true;
  }

  // ── WhatsApp button flow ─────────────────────────────────────────────────

  async processWhatsAppButtonReply(payload: string, fromPhone: string): Promise<void> {
    const underscoreIdx = payload.indexOf('_');
    if (underscoreIdx === -1) return;

    const action = payload.slice(0, underscoreIdx);
    const sessionId = payload.slice(underscoreIdx + 1);

    console.log(`[whatsapp action] action=${action} sessionId=${sessionId} from=${fromPhone}`);

    if (!['confirm', 'absent', 'reschedule'].includes(action)) return;

    if (action !== 'reschedule') {
      await this.processConfirmOrAbsent(sessionId, action);
      return;
    }

    // Reschedule via WhatsApp
    const session = await this.sessions.findSessionForAction(sessionId);
    if (!session) return;
    if (session.patient_status && session.patient_status !== 'pending') return;

    const mode = await this.schedule.getRescheduleMode(session.psychologist_id);

    if (mode === 'manual') {
      await this.handleManualReschedule(sessionId, session);
      return;
    }

    // Automatic: compute slots and send list message
    const [scheduleConfig, existingSessions] = await Promise.all([
      this.schedule.getSchedule(session.psychologist_id),
      this.schedule.getSessionsThisWeek(session.psychologist_id),
    ]);

    console.log(`[reschedule auto] scheduleConfig days=${scheduleConfig.length} existingSessions=${existingSessions.length}`);
    const slots = this.schedule.computeAvailableSlots(scheduleConfig, existingSessions, sessionId);
    console.log(`[reschedule auto] slots computed=${slots.length}`);

    if (slots.length === 0) {
      await sendWhatsAppText(
        fromPhone,
        'Não há horários disponíveis nos próximos dias. Seu psicólogo entrará em contato para reagendar.',
      ).catch(() => {});
      await this.handleManualReschedule(sessionId, session);
      return;
    }

    await sendWhatsAppRescheduleSlots(fromPhone, slots, session.patient?.full_name ?? 'Paciente').catch(err => {
      console.error('[reschedule auto] Erro ao enviar lista de slots via WhatsApp:', err?.message ?? err);
    });
    // Patient status stays 'pending' until they select a slot
  }

  async processWhatsAppSlotSelection(rowId: string, fromPhone: string): Promise<void> {
    const parsed = parseSlotRowId(rowId);
    if (!parsed) return;

    const proposedDate = compactDateToISO(parsed.compactDate);
    await this.createRescheduleRequestWithDate(parsed.sessionId, proposedDate);

    // Confirmation text within service window (free)
    await sendWhatsAppText(
      fromPhone,
      'Solicitação enviada! Seu psicólogo receberá a notificação e confirmará o novo horário em breve.',
    ).catch(() => {});
  }

  // ── Psychologist approval / rejection ────────────────────────────────────

  async approveReschedule(requestId: string, psychologistId: string, newSessionDate: string): Promise<void> {
    const request = await this.sessions.findRescheduleRequestById(requestId);
    if (!request || request.psychologist_id !== psychologistId || request.status !== 'pending') {
      throw Object.assign(new Error('Solicitação não encontrada ou já processada'), { statusCode: 404 });
    }

    await Promise.all([
      this.sessions.updateRescheduleRequest(requestId, 'approved', newSessionDate),
      this.sessions.updateSessionDate(request.session_id, newSessionDate),
      this.sessions.resetReminderFlags(request.session_id),
      this.sessions.updatePatientStatus(request.session_id, 'pending'),
    ]);

    const session = await this.sessions.findSessionForAction(request.session_id);
    if (!session?.patient) return;

    const psychName = session.psychologist?.full_name ?? 'seu psicólogo';
    const waEnabled = session.psychologist?.whatsapp_reminder_enabled ?? false;

    await Promise.allSettled([
      session.patient.email ? sendPatientRescheduleApprovedEmail({
        patientName: session.patient.full_name,
        patientEmail: session.patient.email,
        psychologistName: psychName,
        newSessionDate,
      }) : Promise.resolve(),
      waEnabled && session.patient.phone ? sendWhatsAppPatientRescheduleApproved({
        patientName: session.patient.full_name,
        patientPhone: session.patient.phone,
        psychologistName: psychName,
        newSessionDate,
      }) : Promise.resolve(),
    ]);
  }

  async rejectReschedule(requestId: string, psychologistId: string): Promise<void> {
    const request = await this.sessions.findRescheduleRequestById(requestId);
    if (!request || request.psychologist_id !== psychologistId || request.status !== 'pending') {
      throw Object.assign(new Error('Solicitação não encontrada ou já processada'), { statusCode: 404 });
    }

    await Promise.all([
      this.sessions.updateRescheduleRequest(requestId, 'rejected'),
      this.sessions.cancelSession(request.session_id),
    ]);

    const session = await this.sessions.findSessionForAction(request.session_id);
    if (!session?.patient) return;

    const psychName = session.psychologist?.full_name ?? 'seu psicólogo';
    const waEnabled = session.psychologist?.whatsapp_reminder_enabled ?? false;

    await Promise.allSettled([
      session.patient.email ? sendPatientRescheduleRejectedEmail({
        patientName: session.patient.full_name,
        patientEmail: session.patient.email,
        psychologistName: psychName,
      }) : Promise.resolve(),
      waEnabled && session.patient.phone ? sendWhatsAppPatientRescheduleRejected({
        patientName: session.patient.full_name,
        patientPhone: session.patient.phone,
        psychologistName: psychName,
      }) : Promise.resolve(),
    ]);
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private async processConfirmOrAbsent(sessionId: string, action: string): Promise<void> {
    const session = await this.sessions.findSessionForAction(sessionId);
    console.log(`[whatsapp action] session=${session?.id ?? 'NOT FOUND'} patient=${session?.patient?.full_name ?? 'NO PATIENT'} status=${session?.patient_status}`);
    if (!session?.patient) return;
    if (session.patient_status && session.patient_status !== 'pending') return;

    const psychName = session.psychologist?.full_name ?? 'seu psicólogo';
    const waEnabled = session.psychologist?.whatsapp_reminder_enabled ?? false;
    const psychEmail = await this.getPsychologistEmail(session.psychologist_id);

    if (action === 'confirm') {
      await this.sessions.updatePatientStatus(sessionId, 'confirmed');
      await Promise.allSettled([
        session.patient.email ? sendPatientConfirmedEmail({ patientName: session.patient.full_name, patientEmail: session.patient.email, psychologistName: psychName, sessionDate: session.session_date }) : Promise.resolve(),
        waEnabled && session.patient.phone ? sendWhatsAppPatientConfirmed({ patientName: session.patient.full_name, patientPhone: session.patient.phone, psychologistName: psychName, sessionDate: session.session_date }) : Promise.resolve(),
      ]);
    } else {
      await this.sessions.updatePatientStatus(sessionId, 'absent');
      await Promise.allSettled([
        session.patient.email ? sendPatientAbsentEmail({ patientName: session.patient.full_name, patientEmail: session.patient.email, psychologistName: psychName }) : Promise.resolve(),
        waEnabled && session.patient.phone ? sendWhatsAppPatientAbsent({ patientName: session.patient.full_name, patientPhone: session.patient.phone, psychologistName: psychName }) : Promise.resolve(),
        psychEmail ? sendPsychologistAbsenceNotificationEmail({ psychologistName: psychName, psychologistEmail: psychEmail, patientName: session.patient.full_name, sessionDate: session.session_date }) : Promise.resolve(),
      ]);
    }
  }

  private async handleManualReschedule(sessionId: string, session: NonNullable<Awaited<ReturnType<SessionRepository['findSessionForAction']>>>): Promise<void> {
    if (!session.patient) return;
    if (session.patient_status && session.patient_status !== 'pending') return;

    await this.sessions.updatePatientStatus(sessionId, 'reschedule_requested');
    await this.sessions.createRescheduleRequest(sessionId, session.psychologist_id);

    const psychName = session.psychologist?.full_name ?? 'seu psicólogo';
    const waEnabled = session.psychologist?.whatsapp_reminder_enabled ?? false;
    const psychEmail = await this.getPsychologistEmail(session.psychologist_id);

    console.log(`[handleManualReschedule] waEnabled=${waEnabled} phone=${session.patient?.phone} psychologist=${JSON.stringify(session.psychologist)}`);

    const results = await Promise.allSettled([
      session.patient.email ? sendPatientRescheduleRequestedEmail({ patientName: session.patient.full_name, patientEmail: session.patient.email, psychologistName: psychName }) : Promise.resolve(),
      waEnabled && session.patient.phone ? sendWhatsAppPatientRescheduleRequested({ patientName: session.patient.full_name, patientPhone: session.patient.phone, psychologistName: psychName }) : Promise.resolve(),
      psychEmail ? sendPsychologistRescheduleNotificationEmail({ psychologistName: psychName, psychologistEmail: psychEmail, patientName: session.patient.full_name, sessionDate: session.session_date }) : Promise.resolve(),
    ]);
    results.forEach((r, i) => { if (r.status === 'rejected') console.error(`[handleManualReschedule] falha na ação ${i}:`, r.reason); });
  }

  private async createRescheduleRequestWithDate(sessionId: string, proposedDate: string): Promise<void> {
    const session = await this.sessions.findSessionForAction(sessionId);
    if (!session?.patient) return;
    if (session.patient_status && session.patient_status !== 'pending') return;

    await this.sessions.updatePatientStatus(sessionId, 'reschedule_requested');
    const request = await this.sessions.createRescheduleRequest(sessionId, session.psychologist_id);
    await this.sessions.updateRescheduleRequest(request.id, 'pending', proposedDate);

    const psychName = session.psychologist?.full_name ?? 'seu psicólogo';
    const psychEmail = await this.getPsychologistEmail(session.psychologist_id);

    await Promise.allSettled([
      psychEmail ? sendPsychologistRescheduleNotificationEmail({ psychologistName: psychName, psychologistEmail: psychEmail, patientName: session.patient.full_name, sessionDate: proposedDate }) : Promise.resolve(),
    ]);
  }

  private async getPsychologistEmail(psychologistId: string): Promise<string | null> {
    try {
      const { data: { user } } = await this.supabase.auth.admin.getUserById(psychologistId);
      return user?.email ?? null;
    } catch {
      return null;
    }
  }
}
