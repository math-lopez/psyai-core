import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import supabasePlugin from "./plugins/supabase";
import authPlugin from "./plugins/auth";

import { healthRoute } from "./routes/health.route";
import patientRoutes from "./modules/patients/patient.routes";
import sessionRoutes from "./modules/sessions/session.routes";
import storageRoutes from "./modules/storage/storage.routes";
import accessRoutes from "./modules/access/access.routes";
import patientActivateRoutes from "./modules/access/patient-activate.routes";
import analysisRoutes from "./modules/analysis/analysis.routes";
import attachmentRoutes from "./modules/attachment/attachment.routes";
import { diaryRoutes } from "./modules/diary/diary.routes";
import { treatmentRoutes } from "./modules/treatment/treatment.routes";
import { featuresRoutes } from "./modules/features/features.routes";
import livekitRoutes from "./modules/livekit/livekit.routes";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const hasSupabaseConfig = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "PsyAI Core API",
          description: "API do psyai-core",
          version: "1.0.0",
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
    });
  }

  await app.register(sensible);

  await app.register(rateLimit, {
    global: true,
    max: 120,                // 120 req por janela por IP
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      message: 'Muitas requisições. Tente novamente em alguns instantes.',
    }),
  });

  await app.register(cors, {
    origin: process.env.FRONTEND_URL,
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

  await app.register(healthRoute);

  if (!hasSupabaseConfig) {
    app.log.warn(
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurados; iniciando apenas a rota /health.",
    );

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

  await app.register(supabasePlugin);
  await app.register(authPlugin);

  await app.register(patientActivateRoutes);
  await app.register(patientRoutes);
  await app.register(sessionRoutes);
  await app.register(storageRoutes);
  await app.register(accessRoutes);
  await app.register(analysisRoutes);
  await app.register(attachmentRoutes);
  await app.register(diaryRoutes);
  await app.register(treatmentRoutes);
  await app.register(featuresRoutes);
  await app.register(livekitRoutes);

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
