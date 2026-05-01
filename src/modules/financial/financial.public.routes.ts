import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { FinancialService } from "./financial.service";

// Rotas públicas do financeiro — sem autenticação
const financialPublicRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new FinancialService(fastify);

  fastify.get("/v1/public/charges/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await service.getPublicCharge(id);
    return reply.send({ data });
  });
};

export default financialPublicRoutes;
