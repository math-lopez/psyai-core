import { FastifyInstance } from 'fastify';
import { SessionService } from './session.service';
import { SessionActionService } from './session-action.service';
import { createSessionSchema, updateSessionSchema, createRecurrentSessionSchema } from './session.schemas';
import { replyValidationError } from '../../shared/errors/validation-helper.js';

export default async function sessionRoutes(app: FastifyInstance) {
  const service = new SessionService(app);
  const actionService = () => new SessionActionService(app.supabase);

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
    return service.analyzeSessionAI(request.params.id, request.authUser.id, request.userToken, request.authUser.clinic_id);
  });

  app.get('/v1/patients/:patientId/sessions', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.listByPatient(request.params.patientId, request.authUser.id);
  });

  app.post('/v1/sessions/:id/cancel', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.cancelSession(request.params.id, request.authUser.id);
  });

  app.post('/v1/sessions/recurrent', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = createRecurrentSessionSchema.safeParse(request.body);
    if (!parsed.success) return replyValidationError(reply, parsed.error);
    const created = await service.createRecurrent(request.authUser.id, parsed.data, request.authUser.clinic_id);
    return reply.status(201).send(created);
  });

  app.post('/v1/sessions', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return replyValidationError(reply, parsed.error);
    const created = await service.create(request.authUser.id, parsed.data, request.authUser.clinic_id);
    return reply.status(201).send(created);
  });

  app.put('/v1/sessions/:id', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = updateSessionSchema.safeParse(request.body);
    if (!parsed.success) return replyValidationError(reply, parsed.error);
    return service.update(request.params.id, request.authUser.id, parsed.data);
  });

  app.delete('/v1/sessions/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.delete(request.params.id, request.authUser.id);
  });

  app.post('/v1/sessions/:id/start', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.startSession(request.params.id, request.authUser.id);
  });

  app.post('/v1/sessions/:id/finish', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.finishSession(request.params.id, request.authUser.id, request.userToken, request.authUser.clinic_id);
  });

  app.post('/v1/sessions/:id/process-audio', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.processAudio(request.params.id, request.authUser.id, request.userToken);
  });

  // ── Reschedule requests ──────────────────────────────────────────────────

  app.get('/v1/sessions/reschedule-requests', { preHandler: [app.authenticate] }, async (request: any) => {
    const repo = new (await import('./session.repository')).SessionRepository(app.supabase);
    return repo.listPendingRescheduleRequests(request.authUser.id);
  });

  app.post('/v1/sessions/reschedule-requests/:requestId/approve', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const { new_session_date } = (request.body ?? {}) as { new_session_date?: string };
    if (!new_session_date) return reply.status(400).send({ message: 'new_session_date é obrigatório' });

    await actionService().approveReschedule(request.params.requestId, request.authUser.id, new_session_date);
    return { ok: true };
  });

  app.post('/v1/sessions/reschedule-requests/:requestId/reject', { preHandler: [app.authenticate] }, async (request: any) => {
    await actionService().rejectReschedule(request.params.requestId, request.authUser.id);
    return { ok: true };
  });
}