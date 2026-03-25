export const ANALYSIS_STATUS = [
  "requested",
  "processing",
  "completed",
  "failed",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];

export interface PatientAIAnalysis {
  id: string;
  patient_id: string;
  psychologist_id: string | null;
  status: AnalysisStatus;
  result_json: Record<string, unknown> | null;
  summary_text: string | null;
  error_message: string | null;
  requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestPatientAnalysisResult {
  accepted: true;
  message: string;
}