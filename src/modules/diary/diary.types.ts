export type LogType = string;
export type PromptStatus = string;

export interface DiaryPatientContext {
  patientId: string;
  psychologistId: string;
  userId: string;
}

export interface PatientLogAttachment {
  id: string;
  patient_log_id: string;
  file_name?: string | null;
  file_path?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface PatientLog {
  id: string;
  patient_id: string;
  psychologist_id: string;
  prompt_id?: string | null;
  title?: string | null;
  content?: string | null;
  log_type?: LogType | null;
  created_at?: string | null;
  updated_at?: string | null;
  attachments?: PatientLogAttachment[];
  [key: string]: unknown;
}

export interface PatientLogPrompt {
  id: string;
  patient_id: string;
  psychologist_id: string;
  title?: string | null;
  description?: string | null;
  instructions?: string | null;
  status?: PromptStatus | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface PatientAccessRecord {
  patient_id: string;
  psychologist_id: string;
  user_id: string;
}

export interface PatientOwnerRecord {
  id: string;
  psychologist_id: string;
}

export interface CreateMyLogInput {
  title?: string;
  content?: string;
  log_type?: LogType;
  prompt_id?: string | null;
  [key: string]: unknown;
}

export interface UpdateMyLogInput {
  title?: string;
  content?: string;
  log_type?: LogType;
  prompt_id?: string | null;
  [key: string]: unknown;
}

export interface CreatePromptInput {
  title?: string;
  description?: string;
  instructions?: string;
  status?: PromptStatus;
  due_date?: string | null;
  [key: string]: unknown;
}

export interface UpdatePromptInput {
  title?: string;
  description?: string;
  instructions?: string;
  status?: PromptStatus;
  due_date?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}