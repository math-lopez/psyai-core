import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app";

let appPromise: ReturnType<typeof buildApp> | undefined;

async function getApp() {
  if (!appPromise) {
    appPromise = buildApp();
  }

  const app = await appPromise;
  await app.ready();
  return app;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  // Injeta headers CORS em todas as respostas
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Responde preflight OPTIONS imediatamente, antes do Fastify
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const app = await getApp();

  if (typeof req.url === "string") {
    const parsed = new URL(req.url, "http://localhost");
    const pathParam = parsed.searchParams.getAll("path");

    if (pathParam.length > 0) {
      const normalizedPath = `/${pathParam.join("/")}`.replace(/\/+/g, "/");
      const forwardedParams = new URLSearchParams(parsed.searchParams);
      forwardedParams.delete("path");
      const query = forwardedParams.toString();
      req.url = `${normalizedPath}${query ? `?${query}` : ""}`;
    } else if (req.url.startsWith("/api")) {
      req.url = req.url.replace(/^\/api/, "") || "/";
    }
  }

  app.server.emit("request", req, res);
}
