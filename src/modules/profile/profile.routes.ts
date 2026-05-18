import { FastifyInstance, FastifyPluginAsync } from "fastify";

const profileRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.delete("/v1/account", async (request, reply) => {
    const { error } = await fastify.supabaseAdmin.auth.admin.deleteUser(request.authUser.id);
    if (error) throw fastify.httpErrors.internalServerError("Erro ao excluir conta");
    return reply.send({ success: true });
  });
};

export default profileRoutes;
