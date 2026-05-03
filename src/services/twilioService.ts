import twilio from 'twilio';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function normalizeBrazilianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  // Already has country code: 55 + DDD (2) + number (8 or 9) = 12 or 13 digits
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  // DDD + number: 10 (landline) or 11 (mobile) digits
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return null;
}

export async function sendWhatsAppReminder(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  sessionDate: string;
}): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio não configurado: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_FROM são obrigatórios');
  }

  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) {
    throw new Error(`Número de telefone inválido para WhatsApp: ${params.patientPhone}`);
  }

  const date = new Date(params.sessionDate);
  const formattedDate = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(date, 'HH:mm');

  const body =
    `Olá, ${params.patientName}! 👋\n\n` +
    `Lembrando que sua sessão com *${params.psychologistName}* está agendada para *amanhã*:\n\n` +
    `📅 ${formattedDate}\n` +
    `🕐 ${formattedTime}\n\n` +
    `Precisa remarcar? Entre em contato com seu psicólogo com antecedência.\n\n` +
    `_Mensagem automática — PsiAI_`;

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    from: `whatsapp:${fromNumber}`,
    to: `whatsapp:${toPhone}`,
    body,
  });

  console.log(`[twilio] WhatsApp enviado para ${toPhone} — sessão em ${formattedDate} às ${formattedTime}`);
}

export async function sendWhatsAppHourReminder(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  sessionDate: string;
}): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio não configurado');
  }

  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) {
    throw new Error(`Número inválido: ${params.patientPhone}`);
  }

  const sessionTime = new Date(params.sessionDate);
  const formattedTime = format(sessionTime, 'HH:mm');

  const diffMs = sessionTime.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const timeLabel = diffMin <= 0
    ? 'em instantes'
    : diffMin < 60
      ? `em ${diffMin} minuto${diffMin === 1 ? '' : 's'}`
      : 'em 1 hora';

  const body =
    `⏰ *Sua sessão começa ${timeLabel}!*\n\n` +
    `Olá, ${params.patientName}! Sua sessão com *${params.psychologistName}* começa às *${formattedTime}*.\n\n` +
    `_Mensagem automática — PsiAI_`;

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    from: `whatsapp:${fromNumber}`,
    to: `whatsapp:${toPhone}`,
    body,
  });

  console.log(`[twilio] WhatsApp 1h enviado para ${toPhone} — sessão às ${formattedTime}`);
}

export async function sendWhatsAppSessionStarted(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  joinUrl: string;
}): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio não configurado');
  }

  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) {
    throw new Error(`Número inválido: ${params.patientPhone}`);
  }

  const body =
    `🟢 *${params.psychologistName} está te aguardando!*\n\n` +
    `Olá, ${params.patientName}! Sua sessão já começou. Clique no link abaixo para entrar agora:\n\n` +
    `${params.joinUrl}\n\n` +
    `_Mensagem automática — PsiAI_`;

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    from: `whatsapp:${fromNumber}`,
    to: `whatsapp:${toPhone}`,
    body,
  });

  console.log(`[twilio] WhatsApp de início de sessão enviado para ${toPhone}`);
}
