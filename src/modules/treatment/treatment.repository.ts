import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateTreatmentGoalInput,
  CreateTreatmentPlanInput,
  PatientOwnerRecord,
  TreatmentGoal,
  TreatmentPlan,
  UpdateTreatmentGoalInput,
  UpdateTreatmentPlanInput,
} from "./treatment.types";

export class TreatmentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getPatientOwnerById(patientId: string): Promise<PatientOwnerRecord | null> {
    const { data, error } = await this.supabase
      .from("patients")
      .select("id, psychologist_id")
      .eq("id", patientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async listPlansByPatientId(patientId: string): Promise<TreatmentPlan[]> {
    const { data, error } = await this.supabase
      .from("treatment_plans")
      .select("*, goals:treatment_goals(*)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as TreatmentPlan[];
  }

  async getActivePlanByPatientId(patientId: string): Promise<TreatmentPlan | null> {
    const { data, error } = await this.supabase
      .from("treatment_plans")
      .select("*, goals:treatment_goals(*)")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    return data as TreatmentPlan | null;
  }

  async getPlanById(planId: string): Promise<TreatmentPlan | null> {
    const { data, error } = await this.supabase
      .from("treatment_plans")
      .select("*, goals:treatment_goals(*)")
      .eq("id", planId)
      .maybeSingle();

    if (error) throw error;
    return data as TreatmentPlan | null;
  }

  async archiveActivePlansByPatientId(patientId: string): Promise<void> {
    const { error } = await this.supabase
      .from("treatment_plans")
      .update({ status: "archived" })
      .eq("patient_id", patientId)
      .eq("status", "active");

    if (error) throw error;
  }

  async createPlan(
    payload: CreateTreatmentPlanInput & {
      patient_id: string;
      psychologist_id: string;
    }
  ): Promise<TreatmentPlan> {
    const { data, error } = await this.supabase
      .from("treatment_plans")
      .insert([payload])
      .select("*, goals:treatment_goals(*)")
      .single();

    if (error) throw error;
    return data as TreatmentPlan;
  }

  async updatePlanById(planId: string, updates: UpdateTreatmentPlanInput): Promise<TreatmentPlan> {
    const { data, error } = await this.supabase
      .from("treatment_plans")
      .update(updates)
      .eq("id", planId)
      .select("*, goals:treatment_goals(*)")
      .single();

    if (error) throw error;
    return data as TreatmentPlan;
  }

  async deletePlanById(planId: string): Promise<void> {
    const { error } = await this.supabase
      .from("treatment_plans")
      .delete()
      .eq("id", planId);

    if (error) throw error;
  }

  async getGoalById(goalId: string): Promise<TreatmentGoal | null> {
    const { data, error } = await this.supabase
      .from("treatment_goals")
      .select("*")
      .eq("id", goalId)
      .maybeSingle();

    if (error) throw error;
    return data as TreatmentGoal | null;
  }

  async createGoal(
    payload: CreateTreatmentGoalInput & {
      plan_id: string;
      patient_id: string;
      psychologist_id: string;
      completed_at?: string | null;
    }
  ): Promise<TreatmentGoal> {
    const { data, error } = await this.supabase
      .from("treatment_goals")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;
    return data as TreatmentGoal;
  }

  async updateGoalById(goalId: string, updates: Partial<TreatmentGoal>): Promise<TreatmentGoal> {
    const { data, error } = await this.supabase
      .from("treatment_goals")
      .update(updates)
      .eq("id", goalId)
      .select("*")
      .single();

    if (error) throw error;
    return data as TreatmentGoal;
  }

  async deleteGoalById(goalId: string): Promise<void> {
    const { error } = await this.supabase
      .from("treatment_goals")
      .delete()
      .eq("id", goalId);

    if (error) throw error;
  }
}