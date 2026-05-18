import 'dotenv/config';
import {
  sendWhatsAppPatientRescheduleRequested,
  sendWhatsAppRescheduleSlots,
  sendWhatsAppPatientRescheduleApproved,
  sendWhatsAppPatientRescheduleRejected,
} from '../src/services/whatsappService';

const TEST_PHONE = '+5511940176230';
const PATIENT_NAME = 'Joao Teste';
const PSYCH_NAME = 'Dra. Ana Lima';

// Altere para um dos cenários abaixo:
//
//   'manual-request'   — modo manual: notifica paciente que solicitação foi recebida
//   'auto-slots'       — modo automático: envia lista de horários disponíveis para o paciente escolher
//   'approved'         — psicólogo aprovou o reagendamento
//   'rejected'         — psicólogo recusou o reagendamento
//
const SCENARIO: 'manual-request' | 'auto-slots' | 'approved' | 'rejected' = 'manual-request';

const NEW_SESSION_DATE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // daqui 3 dias

// Slots de exemplo para o modo automático
const FAKE_SLOTS = [
  { id: 'slot_abc123_20260518T1400', label: 'Segunda, 18/05 às 14:00' },
  { id: 'slot_abc123_20260519T0900', label: 'Terça, 19/05 às 09:00' },
  { id: 'slot_abc123_20260520T1600', label: 'Quarta, 20/05 às 16:00' },
];

async function run() {
  switch (SCENARIO) {
    case 'manual-request':
      // Fluxo manual: paciente clica "Reagendar" e psicólogo não tem agenda automática.
      // Paciente recebe confirmação de que a solicitação foi registrada.
      await sendWhatsAppPatientRescheduleRequested({
        patientName: PATIENT_NAME,
        patientPhone: TEST_PHONE,
        psychologistName: PSYCH_NAME,
      });
      console.log('[manual-request] Template psiai_reagendamento_solicitado enviado.');
      break;

    case 'auto-slots':
      // Fluxo automático: sistema calcula horários disponíveis e envia lista interativa.
      // Paciente escolhe um slot; seleção dispara processWhatsAppSlotSelection() no webhook.
      await sendWhatsAppRescheduleSlots(TEST_PHONE, FAKE_SLOTS, PATIENT_NAME);
      console.log('[auto-slots] Lista de horários enviada. Selecione um slot no WhatsApp para simular a escolha do paciente.');
      break;

    case 'approved':
      // Psicólogo aprovou o reagendamento (manual ou automático).
      await sendWhatsAppPatientRescheduleApproved({
        patientName: PATIENT_NAME,
        patientPhone: TEST_PHONE,
        psychologistName: PSYCH_NAME,
        newSessionDate: NEW_SESSION_DATE,
      });
      console.log('[approved] Template psiai_reagendamento_aprovado enviado.');
      break;

    case 'rejected':
      // Psicólogo recusou o reagendamento.
      await sendWhatsAppPatientRescheduleRejected({
        patientName: PATIENT_NAME,
        patientPhone: TEST_PHONE,
        psychologistName: PSYCH_NAME,
      });
      console.log('[rejected] Template psiai_reagendamento_recusado enviado.');
      break;
  }
}

run().catch((err: Error) => console.error('Erro:', err.message));
