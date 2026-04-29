import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { WhatsappService } from "./whatsapp.service";
import { runSessionReminders } from "./whatsapp.reminder";

const whatsappRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new WhatsappService(fastify);

  // ─── Webhook público — Evolution API chama sem autenticação ───────────────
  fastify.post("/v1/whatsapp/webhook", async (request, reply) => {
    const body = request.body as any;

    const instanceName = body?.instance ?? body?.sender;
    const event = body?.event;
    const data = body?.data;

    if (instanceName && event) {
      await service.handleWebhook(instanceName, event, data);
    }

    return reply.status(200).send({ ok: true });
  });

  // ─── Rotas autenticadas ───────────────────────────────────────────────────
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.url === "/v1/whatsapp/webhook") return;
    return fastify.authenticate(request, reply);
  });

  // Inicia conexão — o QR chega via webhook e fica armazenado no banco
  fastify.post("/v1/whatsapp/connect", async (request, reply) => {
    await service.connect(request.authUser.id);
    return reply.send({ ok: true, message: "Aguarde o QR Code ser gerado..." });
  });

  // Frontend faz polling aqui para buscar o QR
  fastify.get("/v1/whatsapp/qr", async (request, reply) => {
    const data = await service.getQR(request.authUser.id);
    return reply.send({ data });
  });

  // Status da conexão
  fastify.get("/v1/whatsapp/status", async (request, reply) => {
    const data = await service.syncStatus(request.authUser.id);
    return reply.send({ data });
  });

  // Desconecta
  fastify.delete("/v1/whatsapp/disconnect", async (request, reply) => {
    await service.disconnect(request.authUser.id);
    return reply.send({ success: true });
  });

  // Dispara lembretes manualmente (teste)
  fastify.post("/v1/whatsapp/reminders/run", async (request, reply) => {
    await runSessionReminders(fastify);
    return reply.send({ success: true });
  });
};

export default whatsappRoutes;
