import { ATTACHMENT_VISIBILITIES } from "./attachment.types";

export const patientIdParamSchema = {
  type: "object",
  required: ["patientId"],
  properties: {
    patientId: { type: "string", format: "uuid" },
  },
} as const;

export const attachmentParamsSchema = {
  type: "object",
  required: ["patientId", "attachmentId"],
  properties: {
    patientId: { type: "string", format: "uuid" },
    attachmentId: { type: "string", format: "uuid" },
  },
} as const;

export const uploadAttachmentQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    visibility: {
      type: "string",
      enum: [...ATTACHMENT_VISIBILITIES],
    },
  },
} as const;

export const patientAttachmentSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    patient_id: { type: "string", format: "uuid" },
    psychologist_id: { type: "string", format: "uuid" },
    file_name: { type: "string" },
    file_path: { type: "string" },
    file_size: { type: "number" },
    file_type: { type: "string" },
    visibility: { type: "string" },
    uploaded_by: { type: "string" },
    created_at: { type: "string" },
  },
} as const;

export const attachmentsListResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "array",
      items: patientAttachmentSchema,
    },
  },
} as const;

export const attachmentResponseSchema = {
  type: "object",
  properties: {
    data: patientAttachmentSchema,
  },
} as const;

export const simpleMessageResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
} as const;

export const signedUrlResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        signedUrl: { type: "string" },
        expiresIn: { type: "number" },
      },
    },
  },
} as const;