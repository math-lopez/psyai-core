import { FastifyInstance } from 'fastify';
import { APPROACH_FEATURES, TherapeuticApproach } from '../../config/approachFeatures';
import { PLAN_LIMITS, SubscriptionTier } from '../../config/plans';

export async function featuresRoutes(app: FastifyInstance) {
  // Retorna as features habilitadas para uma abordagem terapêutica
  app.get('/v1/features/approach/:approach', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const approach = request.params.approach as TherapeuticApproach;

    if (!APPROACH_FEATURES[approach]) {
      return reply.status(400).send({ message: `Abordagem desconhecida: ${approach}` });
    }

    return APPROACH_FEATURES[approach];
  });

  // Retorna os limites de um plano de assinatura
  app.get('/v1/features/plan/:tier', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const tier = request.params.tier as SubscriptionTier;

    if (!PLAN_LIMITS[tier]) {
      return reply.status(400).send({ message: `Plano desconhecido: ${tier}` });
    }

    return PLAN_LIMITS[tier];
  });

  // Retorna todos os planos disponíveis
  app.get('/v1/features/plans', { preHandler: [app.authenticate] }, async () => {
    return PLAN_LIMITS;
  });
}
