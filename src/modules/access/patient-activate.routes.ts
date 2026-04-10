import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AccessService } from "./access.service";
import {
  activatePatientBodySchema,
  activatePatientResponseSchema,
} from "./access.schemas";
import { ActivatePatientInput } from "./access.types";

// Rota pública — sem fastify.authenticate
const patientActivateRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  const accessService = new AccessService(fastify);

  fastify.post<{ Body: ActivatePatientInput }>(
    "/v1/auth/patient/activate",
    {
      schema: {
        tags: ["Patient Auth"],
        summary:
          "Ativa a conta do paciente via link (token) ou código numérico",
        security: [],
        body: activatePatientBodySchema,
        response: {
          201: activatePatientResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await accessService.activatePatient(request.body);

      return reply.code(201).send({
        message:
          "Conta criada com sucesso. Você já pode fazer login no aplicativo.",
      });
    },
  );
};

export default patientActivateRoutes;
