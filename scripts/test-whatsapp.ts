import 'dotenv/config';
import { sendWhatsAppReminder, sendWhatsAppSessionStarted } from '../src/services/whatsappService';

const TEST_PHONE = '+5511940176230';

// Altere para 'session-started' para testar a notificacao de sessao iniciada
let NOTIFICATION = 'reminder';

if (NOTIFICATION === 'session-started') {
  sendWhatsAppSessionStarted({
    patientName: 'Joao Teste',
    patientPhone: TEST_PHONE,
    psychologistName: 'Dra. Ana Lima',
    joinUrl: 'https://psiai.com.br/session/join/abc123',
  })
    .then(() => console.log('Notificacao de sessao iniciada enviada!'))
    .catch((err: Error) => console.error('Erro:', err.message));
} else {
  sendWhatsAppReminder({
    patientName: 'Joao Teste',
    patientPhone: TEST_PHONE,
    psychologistName: 'Dra. Ana Lima',
    sessionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    sessionId: '00000000-0000-0000-0000-000000000000',
  })
    .then(() => console.log('Lembrete enviado com sucesso!'))
    .catch((err: Error) => console.error('Erro:', err.message));
}
