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
  const app = await getApp();

  if (typeof req.url === "string" && req.url.startsWith("/api")) {
    req.url = req.url.replace(/^\/api/, "") || "/";
  }

  app.server.emit("request", req, res);
}
