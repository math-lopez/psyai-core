import { FastifyInstance } from 'fastify';
import { TestService } from './test.service';
import { CreateTemplateSchema, CreateApplicationSchema, SubmitTestSchema } from './test.types';

export default async function testRoutes(app: FastifyInstance) {
  const service = new TestService(app);

  // ── Templates (autenticado) ──────────────────────────────────────────────────

  app.get('/v1/tests/templates', { preHandler: [app.authenticate] }, async (request) => {
    return service.listTemplates(request.authUser.id);
  });

  app.get('/v1/tests/templates/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.getTemplate(request.params.id, request.authUser.id);
  });

  app.post('/v1/tests/templates', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = CreateTemplateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    const created = await service.createTemplate(request.authUser.id, parsed.data);
    return reply.status(201).send(created);
  });

  app.delete('/v1/tests/templates/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.deleteTemplate(request.params.id, request.authUser.id);
  });

  // ── Applications (autenticado) ───────────────────────────────────────────────

  app.post('/v1/tests/applications', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = CreateApplicationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    const created = await service.applyTest(request.authUser.id, parsed.data);
    return reply.status(201).send(created);
  });

  app.get('/v1/patients/:patientId/test-applications', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.listApplicationsByPatient(request.params.patientId, request.authUser.id);
  });

  // ── Público (paciente, sem auth) ─────────────────────────────────────────────

  app.get('/v1/public/tests/:token', async (request: any, reply) => {
    return service.getTestByToken(request.params.token);
  });

  app.post('/v1/public/tests/:token/submit', async (request: any, reply) => {
    const parsed = SubmitTestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    const result = await service.submitTest(request.params.token, parsed.data);
    return reply.status(200).send(result);
  });
}
