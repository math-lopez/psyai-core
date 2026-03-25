const uuidParam = {
  type: "string",
  format: "uuid",
};

export const listPlansSchema = {
  tags: ["Treatment"],
  summary: "Lista planos terapêuticos de um paciente",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
    },
    required: ["patientId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      required: ["data"],
    },
  },
};

export const getActivePlanSchema = {
  tags: ["Treatment"],
  summary: "Busca o plano terapêutico ativo de um paciente",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
    },
    required: ["patientId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          anyOf: [
            { type: "object", additionalProperties: true },
            { type: "null" },
          ],
        },
      },
      required: ["data"],
    },
  },
};

export const createPlanSchema = {
  tags: ["Treatment"],
  summary: "Cria plano terapêutico para um paciente",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
    },
    required: ["patientId"],
  },
  body: {
    type: "object",
    additionalProperties: true,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1 },
      description: { type: "string" },
      status: { type: "string" },
      started_at: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
      ended_at: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        message: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["message", "data"],
    },
  },
};

export const updatePlanSchema = {
  tags: ["Treatment"],
  summary: "Atualiza um plano terapêutico",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      planId: uuidParam,
    },
    required: ["patientId", "planId"],
  },
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      title: { type: "string", minLength: 1 },
      description: { anyOf: [{ type: "string" }, { type: "null" }] },
      status: { type: "string" },
      started_at: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
      ended_at: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["message", "data"],
    },
  },
};

export const deletePlanSchema = {
  tags: ["Treatment"],
  summary: "Exclui um plano terapêutico",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      planId: uuidParam,
    },
    required: ["patientId", "planId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
    },
  },
};

export const createGoalSchema = {
  tags: ["Treatment"],
  summary: "Cria objetivo em um plano terapêutico",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      planId: uuidParam,
    },
    required: ["patientId", "planId"],
  },
  body: {
    type: "object",
    additionalProperties: true,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1 },
      description: { type: "string" },
      status: { type: "string" },
      target_date: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        message: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["message", "data"],
    },
  },
};

export const updateGoalSchema = {
  tags: ["Treatment"],
  summary: "Atualiza objetivo de um plano terapêutico",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      planId: uuidParam,
      goalId: uuidParam,
    },
    required: ["patientId", "planId", "goalId"],
  },
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      title: { type: "string", minLength: 1 },
      description: { anyOf: [{ type: "string" }, { type: "null" }] },
      status: { type: "string" },
      target_date: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["message", "data"],
    },
  },
};

export const deleteGoalSchema = {
  tags: ["Treatment"],
  summary: "Exclui objetivo de um plano terapêutico",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      planId: uuidParam,
      goalId: uuidParam,
    },
    required: ["patientId", "planId", "goalId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
    },
  },
};