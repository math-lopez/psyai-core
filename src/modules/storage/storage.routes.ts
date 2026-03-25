import { FastifyInstance } from "fastify";
import { StorageService } from "./storage.service";

export default async function storageRoutes(app: FastifyInstance) {
  const service = new StorageService(app);

  app.post(
    "/v1/sessions/:id/audio",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          message: "Arquivo não enviado",
        });
      }

      const result = await service.uploadSessionAudio(
        request.authUser.id,
        request.params.id,
        file
      );

      return reply.status(200).send(result);
    }
  );

  app.get(
    "/v1/sessions/:id/audio-url",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const result = await service.getSessionAudioSignedUrl(
        request.authUser.id,
        request.params.id
      );

      return reply.status(200).send(result);
    }
  );

  app.delete(
    "/v1/sessions/:id/audio",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const result = await service.deleteSessionAudio(
        request.authUser.id,
        request.params.id
      );

      return reply.status(200).send(result);
    }
  );
}