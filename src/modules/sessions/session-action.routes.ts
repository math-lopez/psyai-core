import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SessionActionService } from './session-action.service';
import { ScheduleRepository } from '../schedule/schedule.repository';

const ACTION_LABELS: Record<string, string> = {
  confirm:    'Presença confirmada',
  absent:     'Ausência registrada',
  reschedule: 'Solicitação de reagendamento enviada',
};

function page(title: string, icon: string, color: string, body: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — PsiAI</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#fff;border-radius:24px;box-shadow:0 4px 24px rgba(0,0,0,.06);padding:48px 40px;max-width:440px;width:90%;text-align:center;}
    .icon{font-size:48px;margin-bottom:16px;color:${color};}
    h1{margin:0 0 12px;font-size:22px;font-weight:900;color:#0f172a;}
    p{margin:0 0 8px;font-size:15px;color:#64748b;line-height:1.6;}
    .badge{display:inline-block;margin-top:24px;font-size:12px;color:#94a3b8;}
    .slot-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:24px 0;}
    .slot-btn{background:#f1f5ff;border:2px solid transparent;border-radius:14px;padding:14px 10px;font-size:14px;font-weight:700;color:#4f46e5;cursor:pointer;transition:all .15s;}
    .slot-btn:hover,.slot-btn.selected{background:#4f46e5;color:#fff;border-color:#4f46e5;}
    .submit-btn{width:100%;background:#4f46e5;color:#fff;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:900;cursor:pointer;margin-top:8px;}
    .submit-btn:disabled{opacity:.4;cursor:not-allowed;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    ${body}
    <span class="badge">PsiAI</span>
  </div>
</body>
</html>`;
}

function successPage(action: string) {
  const icon = action === 'confirm' ? '✓' : action === 'absent' ? '✗' : '↺';
  const color = action === 'confirm' ? '#16a34a' : action === 'absent' ? '#dc2626' : '#4f46e5';
  return page(
    ACTION_LABELS[action] ?? 'Ação registrada',
    icon,
    color,
    '<p>Seu psicólogo foi notificado. Você pode fechar esta página.</p>',
  );
}

function noSlotsPage() {
  return page(
    'Sem vagas esta semana',
    '📅',
    '#f59e0b',
    '<p>Não há horários disponíveis esta semana. Seu psicólogo será notificado e entrará em contato para reagendar.</p>',
  );
}

function errorPage(msg: string) {
  return page('Link inválido', '✕', '#dc2626', `<p>${msg}</p>`);
}

function slotPickerPage(token: string, slots: Array<{ datetime: string; label: string; id: string }>, backendUrl: string) {
  const slotsJson = JSON.stringify(slots);
  return page(
    'Escolha um horário',
    '📅',
    '#4f46e5',
    `<p>Selecione um horário disponível para esta semana:</p>
    <div class="slot-grid" id="grid"></div>
    <button class="submit-btn" id="btn" disabled>Confirmar horário</button>
    <script>
      const slots = ${slotsJson};
      const grid = document.getElementById('grid');
      const btn = document.getElementById('btn');
      let selected = null;
      slots.forEach(s => {
        const el = document.createElement('button');
        el.className = 'slot-btn';
        el.textContent = s.label;
        el.onclick = () => {
          document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
          el.classList.add('selected');
          selected = s.datetime;
          btn.disabled = false;
        };
        grid.appendChild(el);
      });
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        const res = await fetch('${backendUrl}/v1/public/reschedule-propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '${token}', proposed_date: selected }),
        });
        if (res.ok) {
          document.querySelector('.card').innerHTML = '<div class="icon" style="color:#16a34a">✓</div><h1>Solicitação enviada!</h1><p>Seu psicólogo receberá a notificação e confirmará o novo horário em breve.</p><span class="badge">PsiAI</span>';
        } else {
          btn.textContent = 'Erro, tente novamente';
          btn.disabled = false;
        }
      };
    </script>`,
  );
}

const sessionActionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const svc = () => new SessionActionService(fastify.supabase);

  // ── Email: ação por token ────────────────────────────────────────────────
  fastify.get('/v1/public/session-action', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.type('text/html').send(errorPage('Link incompleto.'));

    try {
      const result = await svc().processEmailToken(token);

      if (!result) return reply.type('text/html').send(errorPage('Este link já foi utilizado ou expirou.'));

      if (result.type === 'done') return reply.type('text/html').send(successPage(result.action));

      if (result.type === 'no_slots') return reply.type('text/html').send(noSlotsPage());

      // redirect_slots: mostra o picker de slots
      const backendUrl = process.env.BACKEND_URL || 'https://api.psiai.com.br';
      return reply.type('text/html').send(slotPickerPage(result.token, result.slots, backendUrl));

    } catch (err) {
      fastify.log.error({ err }, '[session-action] Erro ao processar token');
      return reply.type('text/html').send(errorPage('Ocorreu um erro. Entre em contato com seu psicólogo.'));
    }
  });

  // ── Email: paciente submete slot escolhido ───────────────────────────────
  fastify.post('/v1/public/reschedule-propose', async (request, reply) => {
    const { token, proposed_date } = (request.body ?? {}) as { token?: string; proposed_date?: string };
    if (!token || !proposed_date) return reply.status(400).send({ message: 'token e proposed_date são obrigatórios' });

    const ok = await svc().processEmailSlotProposal(token, proposed_date);
    if (!ok) return reply.status(400).send({ message: 'Token inválido ou expirado' });

    return { ok: true };
  });

  // ── API: slots disponíveis (usado pelo frontend se necessário) ───────────
  fastify.get('/v1/public/reschedule-slots', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ message: 'token obrigatório' });

    const record = await new (await import('./session.repository')).SessionRepository(fastify.supabase).findActionToken(token);
    if (!record || record.used_at || record.action !== 'reschedule' || new Date(record.expires_at) < new Date()) {
      return reply.status(400).send({ message: 'Token inválido ou expirado' });
    }

    const { data: session } = await fastify.supabase
      .from('sessions')
      .select('psychologist_id')
      .eq('id', record.session_id)
      .maybeSingle();

    if (!session) return reply.status(404).send({ message: 'Sessão não encontrada' });

    const repo = new ScheduleRepository(fastify.supabase);
    const [scheduleConfig, existing] = await Promise.all([
      repo.getSchedule(session.psychologist_id),
      repo.getSessionsThisWeek(session.psychologist_id),
    ]);

    const slots = repo.computeAvailableSlots(scheduleConfig, existing, record.session_id);
    return { slots };
  });

  // ── WhatsApp: verificação do hub challenge ───────────────────────────────
  fastify.get('/v1/public/whatsapp/webhook', async (request, reply) => {
    const q = request.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return reply.send(q['hub.challenge']);
    }
    return reply.status(403).send({ message: 'Verificação falhou' });
  });

  // ── WhatsApp: recebe mensagens do paciente ───────────────────────────────
  fastify.post('/v1/public/whatsapp/webhook', async (request, reply) => {
    reply.status(200).send({ received: true });

    try {
      const body = request.body as any;
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      fastify.log.info({
        type:        message?.type ?? 'status_update',
        from:        message?.from,
        interactive: message?.interactive,
        raw:         body?.entry?.[0]?.changes?.[0]?.value,
      }, '[whatsapp webhook] payload recebido');

      if (!message || message.type !== 'interactive') return;

      const fromPhone: string = message.from;
      const interactive = message.interactive;

      if (interactive.type === 'button_reply') {
        const payload: string = interactive.button_reply?.id;
        if (payload) await svc().processWhatsAppButtonReply(payload, fromPhone);

      } else if (interactive.type === 'list_reply') {
        const rowId: string = interactive.list_reply?.id;
        if (rowId) await svc().processWhatsAppSlotSelection(rowId, fromPhone);
      }

    } catch (err) {
      fastify.log.error({ err }, '[whatsapp webhook] Erro ao processar mensagem');
    }
  });
};

export default sessionActionRoutes;
