import cron from "node-cron";
import { FastifyInstance } from "fastify";
import { FinancialService } from "./financial.service";
import { env } from "../../plugins/env";

export function registerTransferJob(fastify: FastifyInstance): void {
  const service = new FinancialService(fastify);
  const schedule = env.CRON_RUN_TRANSFERS_SCHEDULE;

  cron.schedule(schedule, async () => {
    fastify.log.info("[repasse] Iniciando job de repasse automático");
    try {
      await service.processPendingTransfers();
      fastify.log.info("[repasse] Job finalizado");
    } catch (err) {
      fastify.log.error({ err }, "[repasse] Erro inesperado no job de repasse");
    }
  }, { timezone: "America/Sao_Paulo" });

  fastify.log.info(`[cron] Job de repasse registrado — schedule: ${schedule}`);
}
