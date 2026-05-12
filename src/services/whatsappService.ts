import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getCredentials() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN são obrigatórios');
  }
  return { phoneNumberId, accessToken };
}

function normalizeBrazilianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return null;
}

async function sendTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
): Promise<void> {
  const { phoneNumberId, accessToken } = getCredentials();

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: bodyParams.map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    },
  );

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(`Meta WhatsApp API: ${data?.error?.message ?? JSON.stringify(data)}`);
  }
}

export async function sendWhatsAppReminder(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  sessionDate: string;
  psychologistPhone?: string | null;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  const date = new Date(params.sessionDate);
  const formattedDate = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(date, 'HH:mm');

  const psychPhone = params.psychologistPhone
    ? (normalizeBrazilianPhone(params.psychologistPhone) ?? params.psychologistPhone)
    : null;

  await sendTemplate(
    toPhone,
    'psiai_lembrete_sessao',
    [
      params.patientName,
      params.psychologistName,
      formattedDate,
      formattedTime,
      ...(psychPhone ? [psychPhone] : []),
    ],
  );

  console.log(`[whatsapp] Lembrete enviado para ${toPhone} — sessão em ${formattedDate} às ${formattedTime}`);
}

export async function sendWhatsAppSessionStarted(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  joinUrl: string;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  await sendTemplate(toPhone, 'psiai_sessao_iniciada', [
    params.patientName,
    params.psychologistName,
    params.joinUrl,
  ]);

  console.log(`[whatsapp] Notificação de sessão iniciada enviada para ${toPhone}`);
}
