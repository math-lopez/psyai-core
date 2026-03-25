import { FastifyInstance } from "fastify";

export async function healthRoute(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "core-api",
      timestamp: new Date().toISOString(),
    };
  });
}