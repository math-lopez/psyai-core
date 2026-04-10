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
    user_id: { type: ["string", "null"] },
    status: { type: "string" },
    invite_token: { type: ["string", "null"] },
    invite_code: { type: ["string", "null"] },
    invite_expires_at: { type: ["string", "null"] },
    invited_at: { type: ["string", "null"] },
    accepted_at: { type: ["string", "null"] },
    suspended_at: { type: ["string", "null"] },
    revoked_at: { type: ["string", "null"] },
    has_linked_account: { type: ["boolean", "null"] },
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

export const activatePatientBodySchema = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 6 },
    token: { type: "string" },
    code: { type: "string", minLength: 6, maxLength: 6 },
  },
} as const;

export const activatePatientResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
} as const;