import { FastifyInstance } from 'fastify';
import { ClinicService } from './clinic.service';
import {
  createClinicSchema,
  updateClinicSchema,
  createMemberSchema,
  updateMemberSchema,
  registerClinicSchema,
} from './clinic.schemas';

export default async function clinicRoutes(app: FastifyInstance) {
  const service = new ClinicService(app);

  // Registro público de clínica (sem autenticação)
  app.post('/v1/clinic/register', async (request: any, reply) => {
    const parsed = registerClinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    const result = await service.register(parsed.data);
    return reply.status(201).send(result);
  });

  // Retorna a clínica do usuário logado (owner ou membro)
  app.get('/v1/clinic', { preHandler: [app.authenticate] }, async (request) => {
    return service.getMyClinic(request.authUser.id);
  });

  // Cria uma nova clínica (o usuário vira owner)
  app.post('/v1/clinic', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = createClinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    const clinic = await service.create(request.authUser.id, parsed.data);
    return reply.status(201).send(clinic);
  });

  // Atualiza dados da clínica (somente owner/admin)
  app.put('/v1/clinic', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = updateClinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    return service.update(request.authUser.id, parsed.data);
  });

  // Lista membros da clínica (somente owner/admin)
  app.get('/v1/clinic/members', { preHandler: [app.authenticate] }, async (request) => {
    return service.listMembers(request.authUser.id);
  });

  // Adiciona um psicólogo à clínica (cria conta Supabase + vincula)
  app.post('/v1/clinic/members', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = createMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    const member = await service.addMember(request.authUser.id, parsed.data);
    return reply.status(201).send(member);
  });

  // Financeiro consolidado por psicólogo
  app.get('/v1/clinic/financial', { preHandler: [app.authenticate] }, async (request) => {
    return service.getClinicFinancial(request.authUser.id);
  });

  // Stats consolidados da clínica
  app.get('/v1/clinic/stats', { preHandler: [app.authenticate] }, async (request) => {
    return service.getClinicStats(request.authUser.id);
  });

  // Lista todos os pacientes da clínica
  app.get('/v1/clinic/patients', { preHandler: [app.authenticate] }, async (request) => {
    return service.getClinicPatients(request.authUser.id);
  });

  // Transfere paciente para outro psicólogo
  app.post('/v1/clinic/patients/:patientId/transfer', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const { to_psychologist_id } = request.body ?? {};
    if (!to_psychologist_id) {
      return reply.status(400).send({ message: 'to_psychologist_id é obrigatório' });
    }
    return service.transferPatient(request.authUser.id, request.params.patientId, to_psychologist_id);
  });

  // Remove o psicólogo da clínica (mantém a conta Supabase)
  app.delete('/v1/clinic/members/:memberId', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    await service.removeMember(request.authUser.id, request.params.memberId);
    return reply.status(200).send({ success: true });
  });

  // Suspende ou reativa um membro
  app.put('/v1/clinic/members/:memberId', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const parsed = updateMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', errors: parsed.error.flatten() });
    }
    return service.updateMember(request.authUser.id, request.params.memberId, parsed.data);
  });
}
