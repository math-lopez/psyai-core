import { SupabaseClient } from "@supabase/supabase-js";
import { FinancialCharge, FinancialSettings, FinancialSummary, UnbilledSession } from "./financial.types";

export class FinancialRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findSettings(psychologistId: string): Promise<FinancialSettings | null> {
    const { data, error } = await this.supabase
      .from("financial_settings")
      .select("*")
      .eq("psychologist_id", psychologistId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertSettings(
    psychologistId: string,
    payload: Omit<FinancialSettings, "id" | "psychologist_id" | "created_at" | "updated_at">,
  ): Promise<FinancialSettings> {
    const { data, error } = await this.supabase
      .from("financial_settings")
      .upsert({ psychologist_id: psychologistId, ...payload, updated_at: new Date().toISOString() }, { onConflict: "psychologist_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listCharges(
    psychologistId: string,
    filters: { status?: string; patientId?: string; from?: string; to?: string },
  ): Promise<FinancialCharge[]> {
    let query = this.supabase
      .from("financial_charges")
      .select("*, patient:patients(id, full_name)")
      .eq("psychologist_id", psychologistId)
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async findPublicCharge(id: string) {
    const { data, error } = await this.supabase
      .from('financial_charges')
      .select('id, amount, description, due_date, status, psychologist_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string; amount: number; description: string | null; due_date: string | null; status: string; psychologist_id: string } | null;
  }

  async findChargeById(id: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from('financial_charges')
      .select('*, patient:patients(id, full_name, email)')
      .eq('id', id)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();
    if (error) throw error;
    return data as (FinancialCharge & { patient: { id: string; full_name: string; email: string } | null }) | null;
  }

  async createCharge(
    psychologistId: string,
    payload: Pick<FinancialCharge, "patient_id" | "session_id" | "amount" | "description" | "due_date" | "notes">,
  ): Promise<FinancialCharge> {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .insert({ psychologist_id: psychologistId, ...payload, status: "pending" })
      .select("*, patient:patients(id, full_name)")
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(
    id: string,
    psychologistId: string,
    status: string,
  ): Promise<FinancialCharge> {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("psychologist_id", psychologistId)
      .select("*, patient:patients(id, full_name)")
      .single();
    if (error) throw error;

    // Ao cancelar, devolve as sessões vinculadas para a fila de cobrança
    if (status === "cancelled") {
      await this.supabase
        .from("sessions")
        .update({ charge_id: null })
        .eq("charge_id", id);
    }

    return data;
  }

  async findUnbilledSessions(patientId: string, psychologistId: string): Promise<UnbilledSession[]> {
    const { data, error } = await this.supabase
      .from("sessions")
      .select("id, session_date, session_summary_manual, manual_notes")
      .eq("patient_id", patientId)
      .eq("psychologist_id", psychologistId)
      .is("charge_id", null)
      .order("session_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async closePeriod(params: {
    psychologistId: string;
    patientId: string;
    sessionIds: string[];
    amount: number;
    description: string;
  }): Promise<FinancialCharge> {
    const { data: charge, error: chargeError } = await this.supabase
      .from("financial_charges")
      .insert({
        psychologist_id: params.psychologistId,
        patient_id: params.patientId,
        amount: params.amount,
        description: params.description,
        status: "pending",
      })
      .select("*, patient:patients(id, full_name)")
      .single();
    if (chargeError) throw chargeError;

    const { error: sessionsError } = await this.supabase
      .from("sessions")
      .update({ charge_id: charge.id })
      .in("id", params.sessionIds)
      .eq("psychologist_id", params.psychologistId);
    if (sessionsError) throw sessionsError;

    return charge;
  }

  async getSummary(psychologistId: string, month?: string): Promise<FinancialSummary> {
    let query = this.supabase
      .from("financial_charges")
      .select("amount, status")
      .eq("psychologist_id", psychologistId)
      .neq("status", "cancelled");

    if (month) {
      const start = `${month}-01`;
      const end = `${month}-31`;
      query = query.gte("created_at", start).lte("created_at", end);
    }

    const { data, error } = await query;
    if (error) throw error;

    const charges = data ?? [];
    return {
      received: charges.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0),
      pending: charges.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0),
      overdue: charges.filter((c) => c.status === "overdue").reduce((s, c) => s + Number(c.amount), 0),
      total_charges: charges.length,
    };
  }
}
