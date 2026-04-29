import { FastifyInstance } from "fastify";
import { WhatsappService } from "./whatsapp.service";

// Busca sessões que acontecem entre 23h e 25h a partir de agora
// e envia lembrete se ainda não foi enviado
export async function runSessionReminders(fastify: FastifyInstance): Promise<void> {
  const service = new WhatsappService(fastify);

  const now = new Date();
  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: sessions } = await fastify.supabaseAdmin
    .from("sessions")
    .select("id, session_date, psychologist_id, patient:patients(full_name, phone)")
    .gte("session_date", from.toISOString())
    .lte("session_date", to.toISOString())
    .eq("status", "scheduled");

  if (!sessions?.length) return;

  // Filtra sessões que já tiveram lembrete enviado
  const sessionIds = sessions.map((s: any) => s.id);
  const { data: alreadySent } = await fastify.supabaseAdmin
    .from("notification_logs")
    .select("session_id")
    .in("session_id", sessionIds)
    .eq("type", "session_reminder_24h");

  const sentIds = new Set((alreadySent ?? []).map((l: any) => l.session_id));

  for (const session of sessions as any[]) {
    if (sentIds.has(session.id)) continue;
    if (!session.patient?.phone) continue;

    try {
      await service.sendSessionReminder({
        psychologistId: session.psychologist_id,
        patientName: session.patient.full_name,
        patientPhone: session.patient.phone,
        sessionDate: new Date(session.session_date),
      });

      await fastify.supabaseAdmin.from("notification_logs").insert({
        session_id: session.id,
        type: "session_reminder_24h",
        sent_at: new Date().toISOString(),
      });

      fastify.log.info({ sessionId: session.id }, "[whatsapp] lembrete enviado");
    } catch (err: any) {
      fastify.log.error({ sessionId: session.id, err: err.message }, "[whatsapp] falha ao enviar lembrete");
    }
  }
}

// Inicializa o cron dentro do servidor (roda a cada hora)
export function startReminderCron(fastify: FastifyInstance): void {
  const ONE_HOUR = 60 * 60 * 1000;

  const run = async () => {
    try {
      await runSessionReminders(fastify);
    } catch (err: any) {
      fastify.log.error({ err: err.message }, "[whatsapp] erro no cron de lembretes");
    }
  };

  // Roda imediatamente ao iniciar e depois a cada hora
  run();
  setInterval(run, ONE_HOUR);

  fastify.log.info("[whatsapp] cron de lembretes iniciado (intervalo: 1h)");
}
