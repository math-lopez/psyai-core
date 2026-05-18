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

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = (req.headers["origin"] as string) ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  let app;
  try {
    app = await getApp();
  } catch (err) {
    console.error("[handler] Falha ao inicializar app:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Erro interno ao inicializar servidor" }));
    appPromise = undefined; // reseta para tentar novamente na próxima requisição
    return;
  }

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
