const uuidParam = {
  type: "string",
  format: "uuid",
};

export const getMyContextSchema = {
  tags: ["Diary"],
  summary: "Retorna o contexto do paciente logado",
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            patientId: { type: "string", format: "uuid" },
            psychologistId: { type: "string", format: "uuid" },
          },
          required: ["patientId", "psychologistId"],
        },
      },
      required: ["data"],
    },
  },
};

export const listMyLogsSchema = {
  tags: ["Diary"],
  summary: "Lista logs do paciente logado",
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

export const createMyLogSchema = {
  tags: ["Diary"],
  summary: "Cria log para o paciente logado",
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      log_type: { type: "string" },
      prompt_id: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
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

export const updateMyLogSchema = {
  tags: ["Diary"],
  summary: "Atualiza log do paciente logado",
  params: {
    type: "object",
    properties: {
      logId: uuidParam,
    },
    required: ["logId"],
  },
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      log_type: { type: "string" },
      prompt_id: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
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

export const deleteMyLogSchema = {
  tags: ["Diary"],
  summary: "Exclui log do paciente logado",
  params: {
    type: "object",
    properties: {
      logId: uuidParam,
    },
    required: ["logId"],
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

export const listMyPromptsSchema = {
  tags: ["Diary"],
  summary: "Lista prompts do paciente logado",
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

export const updateMyPromptSchema = {
  tags: ["Diary"],
  summary: "Atualiza prompt do paciente logado",
  params: {
    type: "object",
    properties: {
      promptId: uuidParam,
    },
    required: ["promptId"],
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string" },
      completed_at: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
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

export const listPatientLogsSchema = {
  tags: ["Diary"],
  summary: "Lista logs de um paciente do psicólogo autenticado",
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

export const listPatientPromptsSchema = {
  tags: ["Diary"],
  summary: "Lista prompts de um paciente do psicólogo autenticado",
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

export const createPatientPromptSchema = {
  tags: ["Diary"],
  summary: "Cria prompt para um paciente do psicólogo autenticado",
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
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      instructions: { type: "string" },
      status: { type: "string" },
      due_date: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
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

export const updatePatientPromptSchema = {
  tags: ["Diary"],
  summary: "Atualiza prompt de um paciente do psicólogo autenticado",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      promptId: uuidParam,
    },
    required: ["patientId", "promptId"],
  },
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      instructions: { type: "string" },
      status: { type: "string" },
      due_date: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
      completed_at: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
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

export const deletePatientPromptSchema = {
  tags: ["Diary"],
  summary: "Exclui prompt de um paciente do psicólogo autenticado",
  params: {
    type: "object",
    properties: {
      patientId: uuidParam,
      promptId: uuidParam,
    },
    required: ["patientId", "promptId"],
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