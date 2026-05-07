import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AccessService } from "./access.service";
import {
  accessMutationResponseSchema,
  accessResponseSchema,
  patientIdParamSchema,
  simpleMessageResponseSchema,
  updateAccessStatusBodySchema,
} from "./access.schemas";
import { AccessStatus } from "./access.types";
import { PLAN_LIMITS, SubscriptionTier } from "../../config/plans";

const accessRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const accessService = new AccessService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.addHook("preHandler", async (request: any, reply) => {
    const { data } = await fastify.supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", request.authUser.id)
      .maybeSingle();
    const tier = (data?.subscription_tier ?? "free") as string;
    const safeTier: SubscriptionTier = PLAN_LIMITS[tier as SubscriptionTier] ? (tier as SubscriptionTier) : "free";
    if (safeTier === "free") {
      return reply.status(403).send({ message: "O portal do paciente está disponível apenas no plano Profissional. Faça upgrade para continuar." });
    }
  });

  fastify.get(
    "/v1/patients/:patientId/access",
    {
      schema: {
        tags: ["Access"],
        summary: "Busca o acesso do paciente",
        params: patientIdParamSchema,
        response: {
          200: accessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const data = await accessService.getAccessByPatientId(
        patientId,
        psychologistId,
      );

      return reply.send({ data });
    },
  );

  fastify.post(
    "/v1/patients/:patientId/access/invite",
    {
      schema: {
        tags: ["Access"],
        summary: "Cria ou recria convite de acesso para o paciente",
        params: patientIdParamSchema,
        response: {
          200: accessMutationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const data = await accessService.createInvite(patientId, psychologistId);

      return reply.send({
        message: "Convite criado com sucesso",
        data,
      });
    },
  );

  fastify.patch(
    "/v1/patients/:patientId/access/status",
    {
      schema: {
        tags: ["Access"],
        summary: "Atualiza o status do acesso do paciente",
        params: patientIdParamSchema,
        body: updateAccessStatusBodySchema,
        response: {
          200: accessMutationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const { status } = request.body as { status: AccessStatus };
      const psychologistId = request.authUser.id;

      const data = await accessService.updateStatus(
        patientId,
        psychologistId,
        status,
      );

      return reply.send({
        message: "Status do acesso atualizado com sucesso",
        data,
      });
    },
  );

  fastify.post(
    "/v1/patients/:patientId/access/revoke",
    {
      schema: {
        tags: ["Access"],
        summary: "Revoga/suspende o acesso do paciente",
        params: patientIdParamSchema,
        response: {
          200: accessMutationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const data = await accessService.revokeAccess(patientId, psychologistId);

      return reply.send({
        message: "Acesso revogado com sucesso",
        data,
      });
    },
  );

  fastify.delete(
    "/v1/patients/:patientId/access",
    {
      schema: {
        tags: ["Access"],
        summary: "Alias semântico para revogar acesso",
        params: patientIdParamSchema,
        response: {
          200: simpleMessageResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      await accessService.revokeAccess(patientId, psychologistId);

      return reply.send({
        message: "Acesso revogado com sucesso",
      });
    },
  );
};

export default accessRoutes;
