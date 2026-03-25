import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import supabasePlugin from "./plugins/supabase";
import authPlugin from "./plugins/auth";

import { healthRoute } from "./routes/health.route";
import patientRoutes from "./modules/patients/patient.routes";
import sessionRoutes from "./modules/sessions/session.routes";
import storageRoutes from "./modules/storage/storage.routes";
import accessRoutes from "./modules/access/access.routes";
import analysisRoutes from "./modules/analysis/analysis.routes";
import attachmentRoutes from "./modules/attachment/attachment.routes";
import { diaryRoutes } from "./modules/diary/diary.routes";
import { treatmentRoutes } from "./modules/treatment/treatment.routes";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    strictPreflight: false,
  });
  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
    },
  });

  // Allow empty JSON body (e.g. POST /v1/sessions/:id/finish with no payload)
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(supabasePlugin);
  await app.register(authPlugin);

  await app.register(healthRoute);

  await app.register(patientRoutes);
  await app.register(sessionRoutes);
  await app.register(storageRoutes);
  await app.register(accessRoutes);
  await app.register(analysisRoutes);
  await app.register(attachmentRoutes);
  await app.register(diaryRoutes);
  await app.register(treatmentRoutes);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode =
      typeof (error as any).statusCode === "number"
        ? (error as any).statusCode
        : 500;

    return reply.status(statusCode).send({
      message: (error as Error).message || "Erro interno do servidor",
    });
  });

  return app;
}
