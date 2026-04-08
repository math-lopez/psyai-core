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

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "https://www.psyccai.com";

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
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
