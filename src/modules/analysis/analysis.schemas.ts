import { ANALYSIS_STATUS } from "./analysis.types";

export const patientIdParamSchema = {
  type: "object",
  required: ["patientId"],
  properties: {
    patientId: { type: "string", format: "uuid" },
  },
} as const;

export const patientAIAnalysisSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    patient_id: { type: "string", format: "uuid" },
    psychologist_id: { type: ["string", "null"], format: "uuid" },
    status: { type: "string", enum: [...ANALYSIS_STATUS] },
    result_json: { type: ["object", "null"], additionalProperties: true },
    summary_text: { type: ["string", "null"] },
    error_message: { type: ["string", "null"] },
    requested_at: { type: ["string", "null"] },
    started_at: { type: ["string", "null"] },
    completed_at: { type: ["string", "null"] },
    failed_at: { type: ["string", "null"] },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
} as const;

export const latestAnalysisResponseSchema = {
  type: "object",
  properties: {
    data: {
      anyOf: [patientAIAnalysisSchema, { type: "null" }],
    },
  },
} as const;

export const requestAnalysisResponseSchema = {
  type: "object",
  properties: {
    accepted: { type: "boolean" },
    message: { type: "string" },
  },
} as const;

const stringArray = { type: "array", items: { type: "string" } } as const;

export const synthesisResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    evolution_analysis: { type: "string" },
    key_themes: stringArray,
    improvements: stringArray,
    concerns: stringArray,
    risk_flags: stringArray,
    milestones: stringArray,
    recommendations: stringArray,
    sessions_analyzed: { type: "number" },
  },
} as const;