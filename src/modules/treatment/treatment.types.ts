export type PlanStatus = "draft" | "active" | "archived" | string;
export type GoalStatus = "pending" | "in_progress" | "completed" | string;

export interface TreatmentGoal {
  id: string;
  plan_id: string;
  patient_id: string;
  psychologist_id: string;
  title: string;
  description?: string | null;
  status?: GoalStatus | null;
  target_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  psychologist_id: string;
  title: string;
  description?: string | null;
  status?: PlanStatus | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  goals?: TreatmentGoal[];
  [key: string]: unknown;
}

export interface PatientOwnerRecord {
  id: string;
  psychologist_id: string;
}

export interface CreateTreatmentPlanInput {
  title: string;
  description?: string;
  status?: PlanStatus;
  started_at?: string | null;
  ended_at?: string | null;
  [key: string]: unknown;
}

export interface UpdateTreatmentPlanInput {
  title?: string;
  description?: string | null;
  status?: PlanStatus;
  started_at?: string | null;
  ended_at?: string | null;
  [key: string]: unknown;
}

export interface CreateTreatmentGoalInput {
  title: string;
  description?: string;
  status?: GoalStatus;
  target_date?: string | null;
  [key: string]: unknown;
}

export interface UpdateTreatmentGoalInput {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  target_date?: string | null;
  [key: string]: unknown;
}