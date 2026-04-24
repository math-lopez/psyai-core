import { FastifyInstance } from 'fastify';
import { PatientService } from './patient.service';
import { createPatientSchema, updatePatientSchema } from './patient.schemas';

export default async function patientRoutes(app: FastifyInstance) {
  const service = new PatientService(app);

  app.get('/v1/patients', { preHandler: [app.authenticate] }, async (request) => {
    return service.list(request.authUser.id);
  });

  app.get('/v1/patients/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.getById(request.params.id, request.authUser.id);
  });

  app.post('/v1/patients', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = createPatientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    const patient = await service.create(request.authUser.id, parsed.data);
    return reply.status(201).send(patient);
  });

  app.put('/v1/patients/:id', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = updatePatientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    return service.update(request.params.id, request.authUser.id, parsed.data);
  });

  app.delete('/v1/patients/:id', { preHandler: [app.authenticate] }, async (request: any) => {
    return service.delete(request.params.id, request.authUser.id);
  });
}
