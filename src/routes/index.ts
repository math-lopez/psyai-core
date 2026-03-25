import { FastifyInstance } from "fastify";
import { healthRoute } from "./health.route.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoute);
}
