import { ACCESS_STATUS } from "./access.types";

export const patientIdParamSchema = {
  type: "object",
  required: ["patientId"],
  properties: {
    patientId: { type: "string", format: "uuid" },
  },
} as const;

export const updateAccessStatusBodySchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: [...ACCESS_STATUS],
    },
  },
} as const;

export const patientAccessSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    patient_id: { type: "string", format: "uuid" },
    psychologist_id: { type: "string", format: "uuid" },
    status: { type: "string" },
    invite_token: { type: ["string", "null"] },
    invited_at: { type: ["string", "null"] },
    accepted_at: { type: ["string", "null"] },
    suspended_at: { type: ["string", "null"] },
    revoked_at: { type: ["string", "null"] },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
} as const;

export const accessResponseSchema = {
  type: "object",
  properties: {
    data: {
      anyOf: [patientAccessSchema, { type: "null" }],
    },
  },
} as const;

export const accessMutationResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    data: patientAccessSchema,
  },
} as const;

export const simpleMessageResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
} as const;