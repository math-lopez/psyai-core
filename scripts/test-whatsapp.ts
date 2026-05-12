import 'dotenv/config';
import { sendWhatsAppReminder } from '../src/services/whatsappService';

const TEST_PHONE = '+5511940176230';

sendWhatsAppReminder({
  patientName: 'João Teste',
  patientPhone: TEST_PHONE,
  psychologistName: 'Dra. Ana Lima',
  sessionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
})
  .then(() => console.log('WhatsApp enviado com sucesso!'))
  .catch((err) => console.error('Erro:', err.message));
