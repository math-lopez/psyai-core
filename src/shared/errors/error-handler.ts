import { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./app-error.js";

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        details: error.details ?? null,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Erro de validação",
        details: error.flatten(),
      });
    }

    request.log.error(error);

    return reply.status(500).send({
      message: "Erro interno do servidor",
    });
  });
}