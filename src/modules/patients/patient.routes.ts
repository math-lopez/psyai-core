import { FastifyInstance } from 'fastify';
import { PatientService } from './patient.service';

export default async function patientRoutes(app: FastifyInstance) {
  const service = new PatientService(app);

  app.get('/v1/patients', { preHandler: [app.authenticate] }, async (request) => {
    return service.list(request.authUser.id);
  });

  app.get('/v1/patients/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.getById(request.params.id, request.authUser.id);
  });

  app.post('/v1/patients', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    if (!request.body || typeof request.body !== 'object') {
      return reply.status(400).send({ message: 'Body é obrigatório' });
    }
    const patient = await service.create(request.authUser.id, request.body);
    return reply.status(201).send(patient);
  });

  app.put('/v1/patients/:id', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    if (!request.body || typeof request.body !== 'object') {
      return reply.status(400).send({ message: 'Body é obrigatório' });
    }
    return service.update(request.params.id, request.authUser.id, request.body);
  });

  app.delete('/v1/patients/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.delete(request.params.id, request.authUser.id);
  });
}
