import type { FastifyPluginAsync } from "fastify";
import {
  createMyLogSchema,
  createPatientPromptSchema,
  deleteMyLogSchema,
  deletePatientPromptSchema,
  getMyContextSchema,
  listMyLogsSchema,
  listMyPromptsSchema,
  listPatientLogsSchema,
  listPatientPromptsSchema,
  updateMyLogSchema,
  updateMyPromptSchema,
  updatePatientPromptSchema,
} from "./diary.schemas";
import { DiaryRepository } from "./diary.repository";
import { DiaryService } from "./diary.service";
import type {
  CreateMyLogInput,
  CreatePromptInput,
  UpdateMyLogInput,
  UpdatePromptInput,
} from "./diary.types";

type AuthenticatedRequest = {
  authUser: {
    id: string;
    email?: string | null;
  };
};

export const diaryRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new DiaryRepository(fastify.supabase);
  const service = new DiaryService(fastify, repository);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/v1/diary/me/context",
    { schema: getMyContextSchema },
    async (request) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.getMyContext(authUserId);
      return { data };
    }
  );

  fastify.get(
    "/v1/diary/me/logs",
    { schema: listMyLogsSchema },
    async (request) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.listMyLogs(authUserId);
      return { data };
    }
  );

  fastify.post<{ Body: CreateMyLogInput }>(
    "/v1/diary/me/logs",
    { schema: createMyLogSchema },
    async (request, reply) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.createMyLog(authUserId, request.body);

      return reply.code(201).send({
        message: "Log criado com sucesso.",
        data,
      });
    }
  );

  fastify.put<{ Params: { logId: string }; Body: UpdateMyLogInput }>(
    "/v1/diary/me/logs/:logId",
    { schema: updateMyLogSchema },
    async (request) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.updateMyLog(authUserId, request.params.logId, request.body);

      return {
        message: "Log atualizado com sucesso.",
        data,
      };
    }
  );

  fastify.delete<{ Params: { logId: string } }>(
    "/v1/diary/me/logs/:logId",
    { schema: deleteMyLogSchema },
    async (request) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      await service.deleteMyLog(authUserId, request.params.logId);

      return {
        message: "Log excluído com sucesso.",
      };
    }
  );

  fastify.get(
    "/v1/diary/me/prompts",
    { schema: listMyPromptsSchema },
    async (request) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.listMyPrompts(authUserId);
      return { data };
    }
  );

  fastify.patch<{ Params: { promptId: string }; Body: UpdatePromptInput }>(
    "/v1/diary/me/prompts/:promptId",
    { schema: updateMyPromptSchema },
    async (request) => {
      const authUserId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.updateMyPrompt(authUserId, request.params.promptId, request.body);

      return {
        message: "Prompt atualizado com sucesso.",
        data,
      };
    }
  );

  fastify.get<{ Params: { patientId: string } }>(
    "/v1/patients/:patientId/diary/logs",
    { schema: listPatientLogsSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.listPatientLogs(psychologistId, request.params.patientId);
      return { data };
    }
  );

  fastify.get<{ Params: { patientId: string } }>(
    "/v1/patients/:patientId/diary/prompts",
    { schema: listPatientPromptsSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;
      const data = await service.listPatientPrompts(psychologistId, request.params.patientId);
      return { data };
    }
  );

  fastify.post<{ Params: { patientId: string }; Body: CreatePromptInput }>(
    "/v1/patients/:patientId/diary/prompts",
    { schema: createPatientPromptSchema },
    async (request, reply) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.createPatientPrompt(
        psychologistId,
        request.params.patientId,
        request.body
      );

      return reply.code(201).send({
        message: "Prompt criado com sucesso.",
        data,
      });
    }
  );

  fastify.put<{ Params: { patientId: string; promptId: string }; Body: UpdatePromptInput }>(
    "/v1/patients/:patientId/diary/prompts/:promptId",
    { schema: updatePatientPromptSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      const data = await service.updatePatientPrompt(
        psychologistId,
        request.params.patientId,
        request.params.promptId,
        request.body
      );

      return {
        message: "Prompt atualizado com sucesso.",
        data,
      };
    }
  );

  fastify.delete<{ Params: { patientId: string; promptId: string } }>(
    "/v1/patients/:patientId/diary/prompts/:promptId",
    { schema: deletePatientPromptSchema },
    async (request) => {
      const psychologistId = (request as typeof request & AuthenticatedRequest).authUser.id;

      await service.deletePatientPrompt(
        psychologistId,
        request.params.patientId,
        request.params.promptId
      );

      return {
        message: "Prompt excluído com sucesso.",
      };
    }
  );
};

export default diaryRoutes;
