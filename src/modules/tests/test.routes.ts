import { FastifyInstance } from 'fastify';
import { TestService } from './test.service';
import { CreateTemplateSchema, CreateApplicationSchema, SubmitTestSchema } from './test.types';
import { replyValidationError } from '../../shared/errors/validation-helper.js';
import { PLAN_LIMITS, SubscriptionTier } from '../../config/plans';

async function assertTestsPlan(request: any, reply: any) {
  const app: FastifyInstance = (request.server ?? request.routerApp) as FastifyInstance;
  const { data } = await (app as any).supabaseAdmin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', request.authUser.id)
    .maybeSingle();
  const tier = (data?.subscription_tier ?? 'free') as string;
  const safeTier: SubscriptionTier = PLAN_LIMITS[tier as SubscriptionTier] ? (tier as SubscriptionTier) : 'free';
  if (!PLAN_LIMITS[safeTier].hasPsychologicalTests) {
    return reply.status(403).send({ message: 'Testes psicológicos estão disponíveis apenas no plano Profissional. Faça upgrade para continuar.' });
  }
}

export default async function testRoutes(app: FastifyInstance) {
  const service = new TestService(app);

  const proGuard = [app.authenticate, assertTestsPlan];

  // ── Templates (autenticado) ──────────────────────────────────────────────────

  app.get('/v1/tests/templates', { preHandler: proGuard }, async (request) => {
    return service.listTemplates(request.authUser.id);
  });

  app.get('/v1/tests/templates/:id', { preHandler: proGuard }, async (request: any) => {
    return service.getTemplate(request.params.id, request.authUser.id);
  });

  app.post('/v1/tests/templates', { preHandler: proGuard }, async (request: any, reply) => {
    const parsed = CreateTemplateSchema.safeParse(request.body);
    if (!parsed.success) return replyValidationError(reply, parsed.error);
    const created = await service.createTemplate(request.authUser.id, parsed.data);
    return reply.status(201).send(created);
  });

  app.delete('/v1/tests/templates/:id', { preHandler: proGuard }, async (request: any) => {
    return service.deleteTemplate(request.params.id, request.authUser.id);
  });

  // ── Applications (autenticado) ───────────────────────────────────────────────

  app.post('/v1/tests/applications', { preHandler: proGuard }, async (request: any, reply) => {
    const parsed = CreateApplicationSchema.safeParse(request.body);
    if (!parsed.success) return replyValidationError(reply, parsed.error);
    const created = await service.applyTest(request.authUser.id, parsed.data);
    return reply.status(201).send(created);
  });

  app.get('/v1/patients/:patientId/test-applications', { preHandler: proGuard }, async (request: any) => {
    return service.listApplicationsByPatient(request.params.patientId, request.authUser.id);
  });

  // ── Público (paciente, sem auth) ─────────────────────────────────────────────

  app.get('/v1/public/tests/:token', async (request: any, reply) => {
    return service.getTestByToken(request.params.token);
  });

  app.post('/v1/public/tests/:token/submit', async (request: any, reply) => {
    const parsed = SubmitTestSchema.safeParse(request.body);
    if (!parsed.success) return replyValidationError(reply, parsed.error);
    const result = await service.submitTest(request.params.token, parsed.data);
    return reply.status(200).send(result);
  });
}
