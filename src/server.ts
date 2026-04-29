import cron from 'node-cron';
import { buildApp } from "./app";
import { env } from "./plugins/env";
import { ReminderService } from "./services/reminderService";

async function bootstrap() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    app.log.info(`Servidor rodando na porta ${env.PORT}`);

    if (app.supabase) {
      const reminder = new ReminderService(app.supabase, app.log);

      // Roda a cada hora e entrega apenas para psicólogos com lembrete configurado para aquela hora
      cron.schedule('0 * * * *', () => {
        reminder.sendScheduledReminders().catch((err) => {
          app.log.error({ err }, '[cron] Falha no job de lembretes de sessão');
        });
      }, { timezone: 'America/Sao_Paulo' });

      app.log.info('[cron] Job de lembretes de sessão registrado (a cada hora)');
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap();