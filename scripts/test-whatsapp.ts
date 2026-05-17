import 'dotenv/config';
import {
  sendWhatsAppReminder,
  sendWhatsAppPatientConfirmed,
  sendWhatsAppPatientAbsent,
  sendWhatsAppPatientRescheduleRequested,
  sendWhatsAppRescheduleSlots,
  sendWhatsAppPatientRescheduleApproved,
  sendWhatsAppPatientRescheduleRejected,
  sendWhatsAppSessionCancelled,
  sendWhatsAppSessionStarted,
} from '../src/services/whatsappService';

// ─── Configuração ──────────────────────────────────────────────────────────────

const TEST_PHONE = '+5511940176230';
const PATIENT_NAME = 'Joao Teste';
const PSYCH_NAME = 'Dra. Ana Lima';

const SESSION_DATE_TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const SESSION_DATE_3DAYS    = new Date(Date.now() + 3  * 24 * 60 * 60 * 1000).toISOString();
const FAKE_SESSION_ID       = '00000000-0000-0000-0000-000000000000';

// ─── Escolha o cenário ────────────────────────────────────────────────────────
//
//  FLUXO PRINCIPAL
//  1  'reminder'              → Lembrete D-1 com botões (Confirmar / Ausência / Reagendar)
//
//  RESPOSTAS AO LEMBRETE
//  2  'confirmed'             → Paciente confirmou presença
//  3  'absent'                → Paciente informou ausência
//
//  REAGENDAMENTO — MODO MANUAL (psicólogo sem agenda automática)
//  4  'reschedule-manual'     → Solicitação recebida, psicólogo entrará em contato
//
//  REAGENDAMENTO — MODO AUTOMÁTICO (psicólogo com agenda automática)
//  5  'reschedule-auto-slots' → Sistema envia lista de horários disponíveis
//
//  RESOLUÇÃO DO REAGENDAMENTO (manual ou automático)
//  6  'reschedule-approved'   → Psicólogo aprovou o novo horário
//  7  'reschedule-rejected'   → Psicólogo recusou o reagendamento
//
//  EVENTOS DA SESSÃO
//  8  'session-cancelled'     → Psicólogo cancelou a sessão
//  9  'session-started'       → Sessão iniciada (link de acesso)

type Scenario =
  | 'reminder'
  | 'confirmed'
  | 'absent'
  | 'reschedule-manual'
  | 'reschedule-auto-slots'
  | 'reschedule-approved'
  | 'reschedule-rejected'
  | 'session-cancelled'
  | 'session-started';

const SCENARIO: Scenario = 'reminder'; // ← altere aqui

// ─── Slots de exemplo para o modo automático ──────────────────────────────────

const FAKE_SLOTS = [
  { id: `slot_${FAKE_SESSION_ID}_20260518T1400`, label: 'Segunda, 18/05 às 14:00' },
  { id: `slot_${FAKE_SESSION_ID}_20260519T0900`, label: 'Terça, 19/05 às 09:00' },
  { id: `slot_${FAKE_SESSION_ID}_20260520T1600`, label: 'Quarta, 20/05 às 16:00' },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  switch (SCENARIO) {
    case 'reminder':
      await sendWhatsAppReminder({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
        sessionDate:      SESSION_DATE_TOMORROW,
        sessionId:        FAKE_SESSION_ID,
      });
      break;

    case 'confirmed':
      await sendWhatsAppPatientConfirmed({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
        sessionDate:      SESSION_DATE_TOMORROW,
      });
      break;

    case 'absent':
      await sendWhatsAppPatientAbsent({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
      });
      break;

    case 'reschedule-manual':
      await sendWhatsAppPatientRescheduleRequested({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
      });
      break;

    case 'reschedule-auto-slots':
      await sendWhatsAppRescheduleSlots(TEST_PHONE, FAKE_SLOTS, PATIENT_NAME);
      break;

    case 'reschedule-approved':
      await sendWhatsAppPatientRescheduleApproved({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
        newSessionDate:   SESSION_DATE_3DAYS,
      });
      break;

    case 'reschedule-rejected':
      await sendWhatsAppPatientRescheduleRejected({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
      });
      break;

    case 'session-cancelled':
      await sendWhatsAppSessionCancelled({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
        sessionDate:      SESSION_DATE_TOMORROW,
      });
      break;

    case 'session-started':
      await sendWhatsAppSessionStarted({
        patientName:      PATIENT_NAME,
        patientPhone:     TEST_PHONE,
        psychologistName: PSYCH_NAME,
        joinUrl:          'https://psiai.com.br/session/join/abc123',
      });
      break;
  }

  console.log(`[${SCENARIO}] Mensagem enviada para ${TEST_PHONE}`);
}

run().catch((err: Error) => console.error('Erro:', err.message));
