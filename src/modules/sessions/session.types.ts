export type ProcessingStatus =
  | 'draft'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CreateSessionInput {
  patient_id: string;
  session_date: string;
  duration_minutes?: number;
  record_type?: string | null;
  manual_notes?: string | null;
  additional_notes?: string | null;
  clinical_notes?: string | null;
  interventions?: string | null;
  session_summary_manual?: string | null;
  next_steps?: string | null;
}

export interface CreateRecurrentSessionInput {
  patient_id: string;
  session_date: string;
  until_date: string;
  duration_minutes?: number;
  record_type?: string | null;
  manual_notes?: string | null;
  additional_notes?: string | null;
  clinical_notes?: string | null;
  interventions?: string | null;
  session_summary_manual?: string | null;
  next_steps?: string | null;
}

export interface UpdateSessionInput {
  patient_id?: string;
  session_date?: string;
  duration_minutes?: number;
  record_type?: string | null;
  manual_notes?: string | null;
  additional_notes?: string | null;
  clinical_notes?: string | null;
  interventions?: string | null;
  session_summary_manual?: string | null;
  next_steps?: string | null;
  audio_file_name?: string | null;
  audio_file_path?: string | null;
  processing_status?: ProcessingStatus;
}