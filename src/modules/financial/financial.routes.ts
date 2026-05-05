import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { FinancialService } from "./financial.service";

const financialRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new FinancialService(fastify);

  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/v1/financial/settings", async (request, reply) => {
    const data = await service.getSettings(request.authUser.id);
    return reply.send({ data });
  });

  fastify.put("/v1/financial/settings", async (request, reply) => {
    const body = request.body as any;
    const data = await service.saveSettings(request.authUser.id, {
      pix_key:               body.pix_key,
      pix_key_type:          body.pix_key_type,
      beneficiary_name:      body.beneficiary_name,
      default_session_value: body.default_session_value ?? null,
    });
    return reply.send({ data });
  });

  fastify.get("/v1/financial/summary", async (request, reply) => {
    const { month } = request.query as { month?: string };
    const data = await service.getSummary(request.authUser.id, month);
    return reply.send({ data });
  });

  fastify.get("/v1/financial/charges", async (request, reply) => {
    const { status, patientId, from, to } = request.query as Record<string, string>;
    const data = await service.listCharges(request.authUser.id, { status, patientId, from, to });
    return reply.send({ data });
  });

  fastify.post("/v1/financial/charges", async (request, reply) => {
    const body = request.body as any;
    const data = await service.createCharge(request.authUser.id, {
      patient_id:   body.patient_id,
      session_id:   body.session_id ?? null,
      amount:       body.amount,
      description:  body.description ?? null,
      due_date:     body.due_date ?? null,
      notes:        body.notes ?? null,
      billing_type: body.billing_type ?? undefined,
    });
    return reply.status(201).send({ data });
  });

  fastify.post("/v1/financial/charges/:id/sync-asaas", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await service.syncChargeWithAsaas(id, request.authUser.id);
    return reply.send({ data });
  });

  fastify.post("/v1/financial/charges/:id/send-email", async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.sendChargeEmail(id, request.authUser.id);
    return reply.send({ success: true });
  });

  fastify.patch("/v1/financial/charges/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const data = await service.updateStatus(id, request.authUser.id, status);
    return reply.send({ data });
  });

  fastify.get("/v1/patients/:patientId/financial/unbilled-sessions", async (request, reply) => {
    const { patientId } = request.params as { patientId: string };
    const data = await service.getUnbilledSessions(patientId, request.authUser.id);
    return reply.send({ data });
  });

  fastify.post("/v1/patients/:patientId/financial/close-period", async (request, reply) => {
    const { patientId } = request.params as { patientId: string };
    const { session_ids, session_value, description, billing_type } = request.body as {
      session_ids:   string[];
      session_value: number;
      description:   string;
      billing_type?: string;
    };
    const data = await service.closePeriod(
      request.authUser.id,
      patientId,
      session_ids,
      session_value,
      description,
      billing_type as any,
    );
    return reply.status(201).send({ data });
  });
};

export default financialRoutes;
