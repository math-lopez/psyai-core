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
  });
  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
    },
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
