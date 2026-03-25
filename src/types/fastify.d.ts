import "fastify";
import { SupabaseClient, User } from "@supabase/supabase-js";

declare module "fastify" {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: User;
  }
}