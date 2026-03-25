import type { FastifyPluginAsync } from "fastify";
import {
  createGoalSchema,
  createPlanSchema,
  deleteGoalSchema,
  deletePlanSchema,
  getActivePlanSchema,
  listPlansSchema,
  updateGoalSchema,
  updatePlanSchema,
} from "./treatment.schemas";
import { TreatmentRepository } from "./treatment.repository";
import { TreatmentService } from "./treatment.service";
import type {
  CreateTreatmentGoalInput,
  CreateTreatmentPlanInput,
  UpdateTreatmentGoalInput,
  UpdateTreatmentPlanInput,
} from "./treatment.types";

type AuthenticatedRequest = {
  authUser: {
    id: string;
    email?: string | null;
  };
};

export const treatmentRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new TreatmentRepository(fastify.supabase);
  const service = new TreatmentService(fastify, repository);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get<{ Params: { patientId: string } }>(
    "/v1/patients/:patientId/treatment/plans",
    { schema: listPlansSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.listPlans(psychologistId, request.params.patientId);

      return { data };
    }
  );

  fastify.get<{ Params: { patientId: string } }>(
    "/v1/patients/:patientId/treatment/plans/active",
    { schema: getActivePlanSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.getActivePlan(psychologistId, request.params.patientId);

      return { data };
    }
  );

  fastify.post<{ Params: { patientId: string }; Body: CreateTreatmentPlanInput }>(
    "/v1/patients/:patientId/treatment/plans",
    { schema: createPlanSchema },
    async (request, reply) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.createPlan(
        psychologistId,
        request.params.patientId,
        request.body
      );

      return reply.code(201).send({
        message: "Plano criado com sucesso.",
        data,
      });
    }
  );

  fastify.put<{ Params: { patientId: string; planId: string }; Body: UpdateTreatmentPlanInput }>(
    "/v1/patients/:patientId/treatment/plans/:planId",
    { schema: updatePlanSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.updatePlan(
        psychologistId,
        request.params.patientId,
        request.params.planId,
        request.body
      );

      return {
        message: "Plano atualizado com sucesso.",
        data,
      };
    }
  );

  fastify.delete<{ Params: { patientId: string; planId: string } }>(
    "/v1/patients/:patientId/treatment/plans/:planId",
    { schema: deletePlanSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      await service.deletePlan(
        psychologistId,
        request.params.patientId,
        request.params.planId
      );

      return {
        message: "Plano excluído com sucesso.",
      };
    }
  );

  fastify.post<{ Params: { patientId: string; planId: string }; Body: CreateTreatmentGoalInput }>(
    "/v1/patients/:patientId/treatment/plans/:planId/goals",
    { schema: createGoalSchema },
    async (request, reply) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.createGoal(
        psychologistId,
        request.params.patientId,
        request.params.planId,
        request.body
      );

      return reply.code(201).send({
        message: "Objetivo criado com sucesso.",
        data,
      });
    }
  );

  fastify.put<{
    Params: { patientId: string; planId: string; goalId: string };
    Body: UpdateTreatmentGoalInput;
  }>(
    "/v1/patients/:patientId/treatment/plans/:planId/goals/:goalId",
    { schema: updateGoalSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.updateGoal(
        psychologistId,
        request.params.patientId,
        request.params.planId,
        request.params.goalId,
        request.body
      );

      return {
        message: "Objetivo atualizado com sucesso.",
        data,
      };
    }
  );

  fastify.delete<{ Params: { patientId: string; planId: string; goalId: string } }>(
    "/v1/patients/:patientId/treatment/plans/:planId/goals/:goalId",
    { schema: deleteGoalSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      await service.deleteGoal(
        psychologistId,
        request.params.patientId,
        request.params.planId,
        request.params.goalId
      );

      return {
        message: "Objetivo excluído com sucesso.",
      };
    }
  );
};

export default treatmentRoutes;
