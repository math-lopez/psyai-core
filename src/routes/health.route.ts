import { FastifyInstance } from "fastify";

export async function healthRoute(app: FastifyInstance) {
  app.get("/health", async () => {
    const hasSupabaseConfig = Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    return {
      status: hasSupabaseConfig ? "ok" : "degraded",
      service: "core-api",
      dependencies: {
        supabase: hasSupabaseConfig ? "configured" : "missing-config",
      },
      timestamp: new Date().toISOString(),
    };
  });
}
