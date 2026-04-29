import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { WhatsappService } from "./whatsapp.service";
import { runSessionReminders } from "./whatsapp.reminder";

const whatsappRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new WhatsappService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  // Retorna estado atual da conexão
  fastify.get("/v1/whatsapp/status", async (request, reply) => {
    const data = await service.syncStatus(request.authUser.id);
    return reply.send({ data });
  });

  // Inicia conexão e retorna QR Code em base64
  fastify.post("/v1/whatsapp/connect", async (request, reply) => {
    const qr = await service.connect(request.authUser.id);
    return reply.send({ data: qr });
  });

  // Desconecta e remove a instância
  fastify.delete("/v1/whatsapp/disconnect", async (request, reply) => {
    await service.disconnect(request.authUser.id);
    return reply.send({ success: true });
  });

  // Endpoint interno para disparar lembretes manualmente (útil para testes)
  fastify.post("/v1/whatsapp/reminders/run", async (request, reply) => {
    await runSessionReminders(fastify);
    return reply.send({ success: true });
  });
};

export default whatsappRoutes;
