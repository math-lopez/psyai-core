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

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  // Preflight OPTIONS is handled by Vercel edge headers (vercel.json)
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
