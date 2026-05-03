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

      // Lembrete dia-antes: roda a cada hora, filtra pelo horário configurado do psicólogo
      cron.schedule('0 * * * *', () => {
        reminder.sendScheduledReminders().catch((err) => {
          app.log.error({ err }, '[cron] Falha no job de lembretes de sessão');
        });
      }, { timezone: 'America/Sao_Paulo' });

      // Lembrete 1h antes: roda a cada hora, verifica sessões na próxima hora
      cron.schedule('0 * * * *', () => {
        reminder.sendHourReminders().catch((err) => {
          app.log.error({ err }, '[cron] Falha no job de lembrete de 1h');
        });
      }, { timezone: 'America/Sao_Paulo' });

      app.log.info('[cron] Jobs de lembretes registrados (dia-antes + 1h antes)');
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap();