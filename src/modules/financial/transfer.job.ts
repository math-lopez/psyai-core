import cron from "node-cron";
import { FastifyInstance } from "fastify";
import { FinancialService } from "./financial.service";

export function registerTransferJob(fastify: FastifyInstance): void {
  const service = new FinancialService(fastify);

  // Executa todo dia às 08:00 (horário do servidor)
  cron.schedule("0 8 * * *", async () => {
    fastify.log.info("[repasse] Iniciando job de repasse automático");
    try {
      await service.processPendingTransfers();
      fastify.log.info("[repasse] Job finalizado");
    } catch (err) {
      fastify.log.error({ err }, "[repasse] Erro inesperado no job de repasse");
    }
  });
}
