import { FastifyInstance } from 'fastify';
import { SessionService } from './session.service';
import { createSessionSchema, updateSessionSchema } from './session.schemas';

export default async function sessionRoutes(app: FastifyInstance) {
  const service = new SessionService(app);

  app.get('/v1/sessions/stats', { preHandler: [app.authenticate] }, async (request) => {
    return service.getStats(request.authUser.id);
  });

  app.get('/v1/sessions', { preHandler: [app.authenticate] }, async (request) => {
    return service.list(request.authUser.id);
  });

  app.get('/v1/sessions/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.getById(request.params.id, request.authUser.id);
  });

  app.get('/v1/sessions/:id/ai-analysis', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.getSessionAIAnalysis(request.params.id, request.authUser.id);
  });

  app.post('/v1/sessions/:id/analyze-ai', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.analyzeSessionAI(request.params.id, request.authUser.id);
  });

  app.post('/v1/sessions', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Dados inválidos',
        errors: parsed.error.flatten(),
      });
    }

    const created = await service.create(request.authUser.id, parsed.data);
    return reply.status(201).send(created);
  });

  app.put('/v1/sessions/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    const parsed = updateSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return {
        message: 'Dados inválidos',
        errors: parsed.error.flatten(),
      };
    }

    return service.update(request.params.id, request.authUser.id, parsed.data);
  });

  app.delete('/v1/sessions/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.delete(request.params.id, request.authUser.id);
  });

  app.post('/v1/sessions/:id/finish', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.finishSession(request.params.id, request.authUser.id, request.userToken);
  });

  app.post('/v1/sessions/:id/process-audio', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.processAudio(request.params.id, request.authUser.id, request.userToken);
  });
}