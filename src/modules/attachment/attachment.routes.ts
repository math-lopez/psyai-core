import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import { AttachmentService } from "./attachment.service";
import {
  attachmentParamsSchema,
  attachmentResponseSchema,
  attachmentsListResponseSchema,
  patientIdParamSchema,
  signedUrlResponseSchema,
  simpleMessageResponseSchema,
  uploadAttachmentQuerySchema,
} from "./attachment.schemas";
import { AttachmentVisibility } from "./attachment.types";

const attachmentRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  const attachmentService = new AttachmentService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/v1/patients/:patientId/attachments",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Lista anexos do paciente",
        params: patientIdParamSchema,
        response: {
          200: attachmentsListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;

      const data = await attachmentService.list(patientId, psychologistId);

      return reply.send({ data });
    },
  );

  fastify.get(
    "/v1/patients/:patientId/attachments/:attachmentId",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Busca um anexo específico do paciente",
        params: attachmentParamsSchema,
        response: {
          200: attachmentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId, attachmentId } = request.params as {
        patientId: string;
        attachmentId: string;
      };

      const psychologistId = request.authUser.id;

      const data = await attachmentService.getById({
        patientId,
        psychologistId,
        attachmentId,
      });

      return reply.send({ data });
    },
  );

  fastify.post(
    "/v1/patients/:patientId/attachments",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Faz upload de anexo do paciente",
        consumes: ["multipart/form-data"],
        params: patientIdParamSchema,
        querystring: uploadAttachmentQuerySchema,
        response: {
          201: attachmentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const psychologistId = request.authUser.id;
      const query = request.query as {
        visibility?: AttachmentVisibility;
      };

      const file = (await request.file()) as MultipartFile | undefined;

      if (!file) {
        throw fastify.httpErrors.badRequest("Arquivo não enviado");
      }

      const buffer = await file.toBuffer();

      const data = await attachmentService.upload({
        patientId,
        psychologistId,
        fileName: file.filename,
        contentType: file.mimetype,
        fileSize: buffer.length,
        visibility: query.visibility ?? "private_to_psychologist",
        buffer,
      });

      return reply.status(201).send({ data });
    },
  );

  fastify.get(
    "/v1/attachments/me",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Lista anexos compartilhados com o paciente autenticado",
        querystring: {
          type: "object",
          properties: {
            psychologistId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: attachmentsListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser.id;
      const { psychologistId } = request.query as { psychologistId?: string };

      const data = await attachmentService.listForPatient(userId, psychologistId);

      return reply.send({ data });
    },
  );

  fastify.get(
    "/v1/attachments/me/:attachmentId/download-url",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Gera URL assinada para download de um anexo compartilhado com o paciente",
        params: {
          type: "object",
          required: ["attachmentId"],
          properties: {
            attachmentId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            psychologistId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: signedUrlResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser.id;
      const { attachmentId } = request.params as { attachmentId: string };
      const { psychologistId } = request.query as { psychologistId?: string };

      const data = await attachmentService.getDownloadUrlForPatient({
        userId,
        attachmentId,
        psychologistId,
      });

      return reply.send({ data });
    },
  );

  fastify.delete(
    "/v1/patients/:patientId/attachments/:attachmentId",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Remove um anexo do paciente",
        params: attachmentParamsSchema,
        response: {
          200: simpleMessageResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId, attachmentId } = request.params as {
        patientId: string;
        attachmentId: string;
      };

      const psychologistId = request.authUser.id;

      await attachmentService.delete({
        patientId,
        psychologistId,
        attachmentId,
      });

      return reply.send({
        message: "Anexo removido com sucesso",
      });
    },
  );

  fastify.get(
    "/v1/patients/:patientId/attachments/:attachmentId/download-url",
    {
      schema: {
        tags: ["Attachments"],
        summary: "Gera URL assinada para download do anexo",
        params: attachmentParamsSchema,
        response: {
          200: signedUrlResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId, attachmentId } = request.params as {
        patientId: string;
        attachmentId: string;
      };

      const psychologistId = request.authUser.id;

      const data = await attachmentService.getDownloadUrl({
        patientId,
        psychologistId,
        attachmentId,
      });

      return reply.send({ data });
    },
  );
};

export default attachmentRoutes;
