import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ScheduleRepository } from './schedule.repository';

const daySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time:  z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  end_time:    z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
});

const scheduleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const repo = () => new ScheduleRepository(fastify.supabase);

  fastify.get('/v1/schedule', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const r = repo();
    const [schedule, reschedule_mode] = await Promise.all([
      r.getSchedule(request.authUser.id),
      r.getRescheduleMode(request.authUser.id),
    ]);
    return { schedule, reschedule_mode };
  });

  fastify.put('/v1/schedule', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const body = (request.body ?? {}) as { schedule?: unknown; reschedule_mode?: unknown };
    const r = repo();

    if (body.schedule !== undefined) {
      const parsed = z.array(daySchema).safeParse(body.schedule);
      if (!parsed.success) return reply.status(400).send({ message: 'Agenda inválida', details: parsed.error.flatten() });
      await r.setSchedule(request.authUser.id, parsed.data);
    }

    if (body.reschedule_mode !== undefined) {
      if (!['manual', 'automatic'].includes(body.reschedule_mode as string)) {
        return reply.status(400).send({ message: 'reschedule_mode deve ser manual ou automatic' });
      }
      await r.setRescheduleMode(request.authUser.id, body.reschedule_mode as 'manual' | 'automatic');
    }

    return { ok: true };
  });
};

export default scheduleRoutes;
