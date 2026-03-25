export const ATTACHMENT_VISIBILITIES = [
  "private_to_psychologist",
  "shared_with_patient",
] as const;

export type AttachmentVisibility =
  (typeof ATTACHMENT_VISIBILITIES)[number];

export const ATTACHMENT_UPLOADED_BY = [
  "psychologist",
  "patient",
] as const;

export type AttachmentUploadedBy =
  (typeof ATTACHMENT_UPLOADED_BY)[number];

export interface PatientAttachment {
  id: string;
  patient_id: string;
  psychologist_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  visibility: AttachmentVisibility;
  uploaded_by: AttachmentUploadedBy;
  created_at: string;
  updated_at: string | null;
}

export interface UploadAttachmentInput {
  patientId: string;
  psychologistId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  visibility: AttachmentVisibility;
  buffer: Buffer;
}

export interface SignedDownloadUrlResponse {
  signedUrl: string;
  expiresIn: number;
}