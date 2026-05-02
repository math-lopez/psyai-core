import { Resend } from 'resend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import { buildPixPayload } from '../lib/pix';

export async function sendSessionReminderEmail(params: {
  patientName: string;
  patientEmail: string;
  psychologistName: string;
  sessionDate: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@psiai.com.br';

  const { patientName, patientEmail, psychologistName, sessionDate } = params;

  const date = new Date(sessionDate);
  const formattedDate = format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = format(date, 'HH:mm', { locale: ptBR });

  const fromAddress = `${psychologistName} via PsiAI <${FROM}>`;

  console.log(`[email] Enviando lembrete de sessão para ${patientEmail}`);

  const result = await resend.emails.send({
    from: fromAddress,
    to: patientEmail,
    subject: `Lembrete: sua sessão é amanhã às ${formattedTime}`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

                <!-- Header -->
                <tr>
                  <td style="background:#4f46e5;padding:32px 40px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">PsiAI</p>
                    <p style="margin:6px 0 0;font-size:12px;color:#a5b4fc;font-weight:500;">Plataforma para Psicólogos</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Lembrete de sessão</p>
                    <h1 style="margin:0 0 24px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">Olá, ${patientName}!</h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;">
                      Este é um lembrete de que sua sessão com <strong style="color:#0f172a;">${psychologistName}</strong> está agendada para <strong style="color:#0f172a;">amanhã</strong>. Confira os detalhes abaixo.
                    </p>

                    <!-- Session card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5ff;border-radius:16px;margin-bottom:32px;">
                      <tr>
                        <td style="padding:28px 32px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-bottom:16px;border-bottom:1px solid #e0e7ff;">
                                <p style="margin:0 0 4px;font-size:10px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:1px;">Data</p>
                                <p style="margin:0;font-size:16px;font-weight:800;color:#1e1b4b;">${formattedDate}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-top:16px;">
                                <p style="margin:0 0 4px;font-size:10px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:1px;">Horário</p>
                                <p style="margin:0;font-size:16px;font-weight:800;color:#1e1b4b;">${formattedTime}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                      Caso precise remarcar ou cancelar, entre em contato com seu psicólogo com antecedência.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">Este é um e-mail automático, por favor não responda.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`[email] Lembrete enviado com sucesso. id=${result.data?.id}`);
}

export async function sendTestApplicationEmail(params: {
  patientName: string;
  patientEmail: string;
  psychologistName: string;
  testName: string;
  testUrl: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@psiai.com.br';
  const { patientName, patientEmail, psychologistName, testName, testUrl } = params;

  console.log(`[email] Enviando convite de teste para ${patientEmail}`);

  const result = await resend.emails.send({
    from: `${psychologistName} via PsiAI <${FROM}>`,
    to: patientEmail,
    subject: `${psychologistName} enviou um instrumento para você responder`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
                <tr>
                  <td style="background:#4f46e5;padding:32px 40px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">PsiAI</p>
                    <p style="margin:6px 0 0;font-size:12px;color:#a5b4fc;font-weight:500;">Plataforma para Psicólogos</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Instrumento recebido</p>
                    <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">Olá, ${patientName}!</h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;">
                      <strong style="color:#0f172a;">${psychologistName}</strong> enviou o instrumento <strong style="color:#0f172a;">${testName}</strong> para você responder. Clique no botão abaixo quando estiver pronto.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                      <tr>
                        <td align="center">
                          <a href="${testUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:900;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:16px;">
                            Responder agora →
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5ff;border-radius:16px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:18px 24px;">
                          <p style="margin:0;font-size:13px;color:#4338ca;line-height:1.6;">
                            <strong>Este link expira em 7 dias.</strong> Responda no seu próprio tempo, sem pressa.
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                      Se o botão não funcionar: <span style="color:#6366f1;word-break:break-all;">${testUrl}</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">Este é um e-mail automático, por favor não responda.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  console.log(`[email] Convite de teste enviado. id=${result.data?.id}`);
}

export async function sendSessionLinkEmail(params: {
  patientName: string;
  patientEmail: string;
  psychologistName: string;
  joinUrl: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@psiai.com.br';

  const { patientName, patientEmail, psychologistName, joinUrl } = params;
  const fromAddress = `${psychologistName} via PsiAI <${FROM}>`;

  console.log(`[email] Enviando link de sessão para ${patientEmail}`);

  const result = await resend.emails.send({
    from: fromAddress,
    to: patientEmail,
    subject: `Sua sessão está pronta — entre agora`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

                <tr>
                  <td style="background:#4f46e5;padding:32px 40px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;">PsiAI</p>
                    <p style="margin:6px 0 0;font-size:12px;color:#a5b4fc;font-weight:500;">Plataforma para Psicólogos</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Sessão iniciada</p>
                    <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#0f172a;">Olá, ${patientName}!</h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;">
                      <strong style="color:#0f172a;">${psychologistName}</strong> iniciou sua sessão e está te aguardando. Clique no botão abaixo para entrar agora.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${joinUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:900;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:16px;letter-spacing:0.3px;">
                            Entrar na sessão agora →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                      Ou cole este link no navegador:<br/>
                      <span style="color:#6366f1;">${joinUrl}</span>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">Este é um e-mail automático, por favor não responda.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`[email] Link de sessão enviado com sucesso. id=${result.data?.id}`);
}

export async function sendChargeEmail(params: {
  patientName: string;
  patientEmail: string;
  psychologistName: string;
  amount: number;
  description: string | null;
  dueDate: string | null;
  chargeId: string;
  // PIX manual (fallback)
  pixKey?: string;
  beneficiaryName?: string;
  // PIX do Asaas (preferencial)
  asaasPixPayload?: string;
  asaasQrBase64?: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@psiai.com.br';
  const { patientName, patientEmail, psychologistName, amount, description, dueDate, chargeId } = params;

  // Usa dados do Asaas se disponíveis, senão gera PIX manual
  let pixPayload: string;
  let qrBuffer: Buffer;

  if (params.asaasPixPayload && params.asaasQrBase64) {
    pixPayload = params.asaasPixPayload;
    qrBuffer   = Buffer.from(params.asaasQrBase64, 'base64');
  } else if (params.pixKey && params.beneficiaryName) {
    pixPayload = buildPixPayload({ pixKey: params.pixKey, merchantName: params.beneficiaryName, amount });
    qrBuffer   = await QRCode.toBuffer(pixPayload, { width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  } else {
    throw new Error('Nenhuma fonte de dados PIX disponível para o email');
  }

  const formattedAmount = amount.toFixed(2).replace('.', ',');
  const formattedDue    = dueDate ? format(new Date(dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : null;

  const frontendUrl = process.env.FRONTEND_URL || 'https://psiai.com.br';
  const payPageUrl  = `${frontendUrl}/pagar?id=${chargeId}`;

  console.log(`[email] Enviando cobrança PIX para ${patientEmail}`);

  const result = await resend.emails.send({
    from: `${psychologistName} via PsiAI <${FROM}>`,
    to: patientEmail,
    subject: `Cobrança de R$ ${formattedAmount} — ${psychologistName}`,
    attachments: [
      {
        filename: 'qrcode.png',
        content: qrBuffer.toString('base64'),
        contentType: 'image/png',
        contentId: 'qrcode',
      },
    ],
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

                <!-- Header -->
                <tr>
                  <td style="background:#4f46e5;padding:32px 40px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">PsiAI</p>
                    <p style="margin:6px 0 0;font-size:12px;color:#a5b4fc;font-weight:500;">Plataforma para Psicólogos</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Cobrança recebida</p>
                    <h1 style="margin:0 0 6px;font-size:26px;font-weight:900;color:#0f172a;">Olá, ${patientName}!</h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;">
                      <strong style="color:#0f172a;">${psychologistName}</strong> enviou uma cobrança para você. Pague pelo PIX abaixo.
                    </p>

                    <!-- Valor e detalhes -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5ff;border-radius:16px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:24px 28px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:1px;">Valor</p>
                          <p style="margin:0 0 ${description || formattedDue ? '16px' : '0'};font-size:28px;font-weight:900;color:#1e1b4b;">R$ ${formattedAmount}</p>
                          ${description ? `
                          <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:1px;">Descrição</p>
                          <p style="margin:0 ${formattedDue ? '0 16px' : '0'};font-size:14px;color:#374151;">${description}</p>
                          ` : ''}
                          ${formattedDue ? `
                          <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:1px;">Vencimento</p>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#374151;">${formattedDue}</p>
                          ` : ''}
                        </td>
                      </tr>
                    </table>

                    <!-- QR Code -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td align="center">
                          <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#374151;">Escaneie o QR Code com o app do seu banco</p>
                          <img src="cid:qrcode" width="200" height="200" alt="QR Code PIX" style="display:block;border-radius:12px;" />
                        </td>
                      </tr>
                    </table>

                    <!-- Botão copiar (abre página no celular) -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                      <tr>
                        <td align="center">
                          <a href="${payPageUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:900;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:16px;letter-spacing:0.3px;">
                            Toque aqui para copiar o código PIX →
                          </a>
                          <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">Abre uma página com botão de cópia — ideal no celular.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Copia e cola -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Pix Copia e Cola</p>
                          <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;line-height:1.6;font-family:monospace;">${pixPayload}</p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                      Abra o app do seu banco → PIX → Copia e Cola → cole o código acima.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">Este é um e-mail automático, por favor não responda.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  console.log(`[email] Cobrança PIX enviada com sucesso. id=${result.data?.id}`);
}
