export const ACCESS_STATUS = [
  "invited",
  "active",
  "suspended",
  "revoked",
] as const;

export type AccessStatus = (typeof ACCESS_STATUS)[number];

export interface PatientAccess {
  id: string;
  patient_id: string;
  psychologist_id: string;
  status: AccessStatus;
  invite_token: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  suspended_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateAccessStatusInput {
  status: AccessStatus;
}