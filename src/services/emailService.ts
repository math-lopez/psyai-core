import { Resend } from 'resend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function sendSessionScheduledEmail(params: {
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
  const formattedTime = format(date, "HH:mm", { locale: ptBR });

  const fromAddress = `${psychologistName} via PsiAI <${FROM}>`;

  console.log(`[email] Enviando email de sessão para ${patientEmail}`);

  const result = await resend.emails.send({
    from: fromAddress,
    to: patientEmail,
    subject: `Sessão agendada para ${formattedDate}`,
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
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Nova sessão agendada</p>
                    <h1 style="margin:0 0 24px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">Olá, ${patientName}!</h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;">
                      Sua sessão com <strong style="color:#0f172a;">${psychologistName}</strong> foi agendada. Confira os detalhes abaixo.
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

  console.log(`[email] Email enviado com sucesso. id=${result.data?.id}`);
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
