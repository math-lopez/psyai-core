import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: {
      id: string;
      email?: string;
      clinic_id?: string;
      clinic_role?: string;
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

    const userId = data.user.id;

    const { data: membership } = await app.supabase
      .from('clinic_members')
      .select('clinic_id, role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    request.authUser = {
      id: userId,
      email: data.user.email,
      clinic_id: membership?.clinic_id ?? undefined,
      clinic_role: membership?.role ?? undefined,
    };
    request.userToken = token;
  });
});