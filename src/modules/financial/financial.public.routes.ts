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

  // Webhook do Asaas — chamado automaticamente quando o status do pagamento muda
  fastify.post("/v1/webhooks/asaas", async (request, reply) => {
    const token = (request.headers['asaas-access-token'] ?? request.headers['authorization']) as string;
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken && token !== expectedToken) {
      return reply.status(401).send({ message: 'Token inválido' });
    }

    const body = request.body as any;
    const event   = body?.event as string;
    const payment = body?.payment;

    if (!payment?.id || !event) return reply.status(200).send({ received: true });

    const internalStatus = asaasStatusToInternal(payment.status);

    // Apenas eventos relevantes
    if (!['RECEIVED', 'CONFIRMED', 'OVERDUE', 'CANCELLED', 'DELETED'].includes(payment.status)) {
      return reply.status(200).send({ received: true });
    }

    try {
      const charge = await service.findChargeByAsaasPaymentId(payment.id);
      if (charge) {
        await service.updateStatusById(charge.id, internalStatus);
        fastify.log.info(`[asaas webhook] Cobrança ${charge.id} → ${internalStatus}`);
      }
    } catch (err) {
      fastify.log.error({ err }, '[asaas webhook] Falha ao processar evento');
    }

    return reply.status(200).send({ received: true });
  });
};

export default financialPublicRoutes;
