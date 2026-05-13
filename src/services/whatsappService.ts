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

type QuickReplyButton = { index: number; payload: string };

async function sendTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  quickReplyButtons?: QuickReplyButton[],
): Promise<void> {
  const { phoneNumberId, accessToken } = getCredentials();

  const components: object[] = [
    { type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) },
  ];

  if (quickReplyButtons?.length) {
    for (const btn of quickReplyButtons) {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(btn.index),
        parameters: [{ type: 'payload', payload: btn.payload }],
      });
    }
  }

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
          components,
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
  sessionId: string;
  psychologistPhone?: string | null;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  const date = new Date(params.sessionDate);
  const formattedDate = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(date, 'HH:mm');

  // Template psiai_lembrete_com_acoes com botões interativos.
  // Necessita aprovação no Meta Business Manager antes de usar.
  // Estrutura do template:
  //   Body: Olá, {{1}}! Sua sessão com {{2}} está agendada para {{3}} às {{4}}. Como deseja proceder?
  //   Button 0 (quick_reply): "Confirmar ✓"
  //   Button 1 (quick_reply): "Informar Ausência"
  //   Button 2 (quick_reply): "Solicitar Reagendamento"
  await sendTemplate(
    toPhone,
    'psiai_lembrete_com_acoes',
    [params.patientName, params.psychologistName, formattedDate, formattedTime],
    [
      { index: 0, payload: `confirm_${params.sessionId}` },
      { index: 1, payload: `absent_${params.sessionId}` },
      { index: 2, payload: `reschedule_${params.sessionId}` },
    ],
  );

  console.log(`[whatsapp] Lembrete com ações enviado para ${toPhone} — sessão ${params.sessionId}`);
}

// ── Notificações ao paciente após ação ──────────────────────────────────────
//
// Os templates abaixo precisam ser criados e aprovados no Meta Business Manager.
//
// psiai_presenca_confirmada  — Body: Olá, {{1}}! Presença confirmada com {{2}} em {{3}} às {{4}}. Até lá!
// psiai_ausencia_registrada  — Body: Olá, {{1}}! Ausência registrada. {{2}} foi notificado(a).
// psiai_reagendamento_solicitado — Body: Olá, {{1}}! Solicitação de reagendamento recebida. {{2}} entrará em contato.
// psiai_reagendamento_aprovado   — Body: Olá, {{1}}! {{2}} confirmou seu reagendamento para {{3}} às {{4}}. 📅
// psiai_reagendamento_recusado   — Body: Olá, {{1}}! {{2}} não pôde aprovar o reagendamento. Entre em contato.

export async function sendWhatsAppPatientConfirmed(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  sessionDate: string;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  const date = new Date(params.sessionDate);
  const formattedDate = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(date, 'HH:mm');

  await sendTemplate(toPhone, 'psiai_presenca_confirmada', [
    params.patientName, params.psychologistName, formattedDate, formattedTime,
  ]);

  console.log(`[whatsapp] Confirmação de presença enviada para ${toPhone}`);
}

export async function sendWhatsAppPatientAbsent(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  await sendTemplate(toPhone, 'psiai_ausencia_registrada', [
    params.patientName, params.psychologistName,
  ]);

  console.log(`[whatsapp] Ausência registrada enviada para ${toPhone}`);
}

export async function sendWhatsAppPatientRescheduleRequested(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  await sendTemplate(toPhone, 'psiai_reagendamento_solicitado', [
    params.patientName, params.psychologistName,
  ]);

  console.log(`[whatsapp] Solicitação de reagendamento enviada para ${toPhone}`);
}

export async function sendWhatsAppPatientRescheduleApproved(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
  newSessionDate: string;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  const date = new Date(params.newSessionDate);
  const formattedDate = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(date, 'HH:mm');

  await sendTemplate(toPhone, 'psiai_reagendamento_aprovado', [
    params.patientName, params.psychologistName, formattedDate, formattedTime,
  ]);

  console.log(`[whatsapp] Aprovação de reagendamento enviada para ${toPhone}`);
}

export async function sendWhatsAppPatientRescheduleRejected(params: {
  patientName: string;
  patientPhone: string;
  psychologistName: string;
}): Promise<void> {
  const toPhone = normalizeBrazilianPhone(params.patientPhone);
  if (!toPhone) throw new Error(`Número inválido: ${params.patientPhone}`);

  await sendTemplate(toPhone, 'psiai_reagendamento_recusado', [
    params.patientName, params.psychologistName,
  ]);

  console.log(`[whatsapp] Recusa de reagendamento enviada para ${toPhone}`);
}

// ── Mensagens dentro da Service Window (grátis, não precisam de aprovação) ──

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  const toPhone = normalizeBrazilianPhone(to) ?? to;
  const { phoneNumberId, accessToken } = getCredentials();

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: text },
      }),
    },
  );

  const data = await response.json() as any;
  if (!response.ok) throw new Error(`Meta WhatsApp API: ${data?.error?.message ?? JSON.stringify(data)}`);
}

export async function sendWhatsAppRescheduleSlots(
  to: string,
  slots: Array<{ id: string; label: string }>,
  patientName: string,
): Promise<void> {
  const toPhone = normalizeBrazilianPhone(to) ?? to;
  const { phoneNumberId, accessToken } = getCredentials();

  // WhatsApp List Message — enviado dentro da Service Window (grátis)
  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: `Olá, ${patientName}! Escolha um horário disponível para esta semana:`,
          },
          footer: { text: 'PsiAI' },
          action: {
            button: 'Ver horários',
            sections: [{
              title: 'Horários disponíveis',
              rows: slots.map(s => ({ id: s.id, title: s.label })),
            }],
          },
        },
      }),
    },
  );

  const data = await response.json() as any;
  if (!response.ok) throw new Error(`Meta WhatsApp API: ${data?.error?.message ?? JSON.stringify(data)}`);
  console.log(`[whatsapp] Lista de slots enviada para ${toPhone}`);
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
