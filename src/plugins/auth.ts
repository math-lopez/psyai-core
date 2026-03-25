import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: {
      id: string;
      email?: string;
    };
    userToken: string;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function authPlugin(app) {
  app.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Token não informado' });
    }

    const token = authHeader.replace('Bearer ', '');

    const { data, error } = await app.supabase.auth.getUser(token);

    if (error || !data.user) {
      return reply.status(401).send({ message: 'Token inválido' });
    }

    request.authUser = {
  id: data.user.id,
  email: data.user.email,
};
request.userToken = token;
  });
});