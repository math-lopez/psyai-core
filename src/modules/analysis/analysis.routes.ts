import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AnalysisService } from "./analysis.service";
import {
  latestAnalysisResponseSchema,
  patientIdParamSchema,
  requestAnalysisResponseSchema,
} from "./analysis.schemas";

const analysisRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const analysisService = new AnalysisService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/patients/:patientId/analysis/latest",
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
    "/patients/:patientId/analysis/request",
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
};

export default analysisRoutes;