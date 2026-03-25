import { FastifyInstance } from "fastify";
import { healthRoute } from "./health.route.js";
import { sessionsRoutes } from "../modules/sessions1/presentation/routes/sessions.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoute);

  await app.register(async function v1Routes(v1) {
    await v1.register(sessionsRoutes, { prefix: "/sessions" });
  }, { prefix: "/v1" });
}