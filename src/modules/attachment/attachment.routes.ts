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
    "/patients/:patientId/attachments",
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
    "/patients/:patientId/attachments/:attachmentId",
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
    "/patients/:patientId/attachments",
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

  fastify.delete(
    "/patients/:patientId/attachments/:attachmentId",
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
    "/patients/:patientId/attachments/:attachmentId/download-url",
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