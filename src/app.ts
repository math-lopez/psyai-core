import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import { AppError } from "./shared/errors/app-error.js";

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
import financialRoutes from "./modules/financial/financial.routes";
import financialPublicRoutes from "./modules/financial/financial.public.routes";
import { registerTransferJob } from "./modules/financial/transfer.job";
import profileRoutes from "./modules/profile/profile.routes";
import testRoutes from "./modules/tests/test.routes";

const LOKI_LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

function buildLokiPushUrl(host: string) {
  const normalizedHost = host.replace(/\/+$/, "");
  return normalizedHost.endsWith("/loki/api/v1/push")
    ? normalizedHost
    : `${normalizedHost}/loki/api/v1/push`;
}

function safeStringifyLog(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") {
        return item.toString();
      }

      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack,
        };
      }

      if (item && typeof item === "object") {
        if (seen.has(item)) {
          return "[Circular]";
        }
        seen.add(item);
      }

      return item;
    });
  } catch {
    return JSON.stringify({ message: "Log nao serializavel" });
  }
}

function buildVercelLokiHook(lokiUrl: string, lokiUser: string, lokiPassword: string) {
  const pushUrl = buildLokiPushUrl(lokiUrl);
  const authorization = `Basic ${Buffer.from(`${lokiUser}:${lokiPassword}`).toString("base64")}`;

  return function logMethod(args: unknown[], method: (...args: unknown[]) => void, level: number) {
    method.apply(this, args);

    try {
      const levelLabel = LOKI_LEVEL_LABELS[level] ?? "info";
      const firstArg = args[0];
      const secondArg = args[1];
      const context = firstArg && typeof firstArg === "object" ? firstArg : undefined;
      const message =
        typeof firstArg === "string"
          ? firstArg
          : typeof secondArg === "string"
            ? secondArg
            : "log";

      const stream = {
        streams: [
          {
            stream: {
              app: "psyai-core",
              env: process.env.NODE_ENV ?? "production",
              runtime: "vercel",
              level: levelLabel,
            },
            values: [
              [
                `${Date.now() * 1_000_000}`,
                safeStringifyLog({
                  level: levelLabel,
                  message,
                  context,
                }),
              ],
            ],
          },
        ],
      };

      fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
        },
        body: JSON.stringify(stream),
      }).catch((err) => {
        console.error("[loki] Falha ao enviar log:", err);
      });
    } catch (err) {
      console.error("[loki] Falha ao preparar log:", err);
    }
  };
}

function buildLoggerConfig() {
  const lokiUrl = process.env.LOKI_URL;
  const lokiUser = process.env.LOKI_USER;
  const lokiPassword = process.env.LOKI_PASSWORD;

  if (!lokiUrl || !lokiUser || !lokiPassword) {
    return { level: 'info' };
  }

  // pino worker threads não funcionam em Vercel serverless; envie direto para Loki.
  if (process.env.VERCEL === '1') {
    return {
      level: 'info',
      hooks: {
        logMethod: buildVercelLokiHook(lokiUrl, lokiUser, lokiPassword),
      },
    };
  }

  return {
    level: 'info',
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: 1 },
          level: 'info',
        },
        {
          target: 'pino-loki',
          options: {
            host: lokiUrl,
            basicAuth: { username: lokiUser, password: lokiPassword },
            labels: {
              app: 'psyai-core',
              env: process.env.NODE_ENV ?? 'production',
            },
            interval: 5,
            silenceErrors: false,
            replaceTimestamp: false,
          },
          level: 'info',
        },
      ],
    },
  };
}

export async function buildApp() {
  const app = Fastify({
    logger: buildLoggerConfig(),
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
      const err = error as Error & { statusCode?: number };
      const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
      request.log.error(
        { requestId: request.id, method: request.method, url: request.url, statusCode, stack: err.stack },
        err.message,
      );
      return reply.status(statusCode).send({
        message: statusCode < 500 ? err.message : "Erro interno do servidor",
      });
    });

    return app;
  }

  await app.register(supabasePlugin);
  await app.register(authPlugin);

  await app.register(patientActivateRoutes);
  await app.register(financialPublicRoutes);
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
  await app.register(financialRoutes);
  await app.register(profileRoutes);
  await app.register(testRoutes);

  // Cron só roda em processo persistente — não em Vercel serverless
  if (process.env.VERCEL !== "1") {
    registerTransferJob(app);
  }

  app.setErrorHandler((error, request, reply) => {
    const ctx = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: (request as any).authUser?.id,
    };

    if (error instanceof ZodError) {
      request.log.warn({ ...ctx, validation: error.flatten() }, "Validation error (uncaught ZodError)");
      return reply.status(400).send({ message: "Dados invalidos", details: error.flatten() });
    }

    if (error instanceof AppError) {
      request.log.warn({ ...ctx, statusCode: error.statusCode }, error.message);
      return reply.status(error.statusCode).send({
        message: error.message,
        details: error.details ?? null,
      });
    }

    const err = error as Error & { statusCode?: number };
    const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;

    if (statusCode >= 500) {
      request.log.error({ ...ctx, statusCode, stack: err.stack }, err.message || "Erro desconhecido");
    } else {
      request.log.warn({ ...ctx, statusCode }, err.message);
    }

    return reply.status(statusCode).send({
      message: statusCode < 500 ? (err.message || "Erro na requisicao") : "Erro interno do servidor",
    });
  });

  return app;
}
