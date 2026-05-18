import cron from 'node-cron';
import { buildApp } from "./app";
import { env } from "./plugins/env";
import { ReminderService } from "./services/reminderService";
import { FinancialReminderService } from "./services/financialReminderService";
import { SessionStartingSoonService } from "./services/sessionStartingSoonService";

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

      // Lembrete 24h antes: roda a cada hora
      cron.schedule('0 * * * *', () => {
        reminder.sendReminders().catch((err) => {
          app.log.error({ err }, '[cron] Falha no job de lembretes de sessão');
        });
      }, { timezone: 'America/Sao_Paulo' });

      app.log.info('[cron] Job de lembrete 24h registrado');

      const financialReminder = new FinancialReminderService(app.supabase, app.log);

      // Lembrete financeiro mensal: roda no dia 1 de cada mês às 8h
      cron.schedule('0 8 1 * *', () => {
        financialReminder.sendMonthlyReminders().catch((err) => {
          app.log.error({ err }, '[cron] Falha no job de lembrete financeiro mensal');
        });
      }, { timezone: 'America/Sao_Paulo' });

      app.log.info('[cron] Job de lembrete financeiro mensal registrado');

      const sessionSoon = new SessionStartingSoonService(app.supabase, app.log);

      // Sessão em breve: roda a cada 10 minutos
      cron.schedule('*/10 * * * *', () => {
        sessionSoon.sendUpcomingNotifications().catch((err) => {
          app.log.error({ err }, '[cron] Falha no job de sessão em breve');
        });
      }, { timezone: 'America/Sao_Paulo' });

      app.log.info('[cron] Job de sessão em breve registrado');
    }
    
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap();