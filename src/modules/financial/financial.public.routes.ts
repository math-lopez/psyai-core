import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { FinancialService } from "./financial.service";
import { asaasStatusToInternal } from "../../services/asaasService";

// Rotas públicas do financeiro — sem autenticação
const financialPublicRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new FinancialService(fastify);

  fastify.get("/v1/public/platform-fees", async (_request, reply) => {
    return reply.send({
      data: {
        platformFeePercent:     Number(process.env.PLATFORM_FEE_PERCENT ?? 3),
        asaasPixFee:            0.99,
        asaasBoletoFee:         3.49,
        asaasCreditCardPercent: 2.99,
      },
    });
  });

  fastify.get("/v1/public/charges/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await service.getPublicCharge(id);
    return reply.send({ data });
  });

  // Webhook do Asaas — responde 200 imediatamente e processa em background
  // para evitar timeout no Vercel serverless que causa "interrompido" no Asaas
  fastify.post("/v1/webhooks/asaas", async (request, reply) => {
    const token = (request.headers['asaas-access-token'] ?? request.headers['authorization']) as string;
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken && token !== expectedToken) {
      return reply.status(401).send({ message: 'Token inválido' });
    }

    const body    = request.body as any;
    const event   = body?.event as string;
    const payment = body?.payment;

    // Responde imediatamente para o Asaas não marcar como interrompido
    reply.status(200).send({ received: true });

    // Processa em background após resposta enviada
    if (!payment?.id || !event) return;

    const internalStatus = asaasStatusToInternal(payment.status);

    if (!['RECEIVED', 'CONFIRMED', 'OVERDUE', 'CANCELLED', 'DELETED'].includes(payment.status)) return;

    try {
      const charge = await service.findChargeByAsaasPaymentId(payment.id);
      if (charge) {
        await service.updateStatusById(charge.id, internalStatus);
        fastify.log.info(`[asaas webhook] Cobrança ${charge.id} → ${internalStatus}`);
      }
    } catch (err) {
      fastify.log.error({ err }, '[asaas webhook] Falha ao processar evento');
    }
  });

  // Endpoint chamado pelo Vercel Cron para processar repasses
  // O Vercel injeta Authorization: Bearer {CRON_SECRET} automaticamente
  fastify.get("/v1/internal/run-transfers", async (request, reply) => {
    const auth = request.headers["authorization"];
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || auth !== expected) {
      return reply.status(401).send({ message: "Não autorizado" });
    }

    reply.status(200).send({ started: true });

    service.processPendingTransfers().catch((err) => {
      fastify.log.error({ err }, "[repasse] Erro no job de repasse via cron");
    });
  });
};

export default financialPublicRoutes;
