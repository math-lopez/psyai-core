import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AnalysisService } from "./analysis.service";
import {
  latestAnalysisResponseSchema,
  patientIdParamSchema,
  requestAnalysisResponseSchema,
  synthesisResponseSchema,
} from "./analysis.schemas";

const analysisRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const analysisService = new AnalysisService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/v1/patients/:patientId/analysis/latest",
    {
      schema: {
        tags: ["Analysis"],
        summary: "Busca a última análise de IA do paciente",
        params: patientIdParamSchema,
        response: {
          200: latestAnalysisResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const data = await analysisService.getLatestAnalysis(
        patientId,
        psychologistId,
      );

      return reply.send({ data });
    },
  );

  fastify.post(
    "/v1/patients/:patientId/analysis/request",
    {
      schema: {
        tags: ["Analysis"],
        summary: "Solicita processamento de análise do paciente",
        params: patientIdParamSchema,
        response: {
          202: requestAnalysisResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const result = await analysisService.requestAnalysis(
        patientId,
        psychologistId,
      );

      return reply.status(202).send(result);
    },
  );
  fastify.post(
    "/v1/patients/:patientId/synthesize",
    {
      schema: {
        tags: ["Analysis"],
        summary: "Gera síntese longitudinal do paciente com IA",
        params: patientIdParamSchema,
        response: {
          200: synthesisResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const result = await analysisService.synthesizePatient(patientId, psychologistId);

      return reply.send(result);
    },
  );
};

export default analysisRoutes;
