import { SupabaseClient } from "@supabase/supabase-js";
import { BillingType, FinancialCharge, FinancialSettings, FinancialSummary, PendingTransfer, UnbilledSession } from "./financial.types";

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

    if (filters.status)    query = query.eq("status", filters.status);
    if (filters.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters.from)      query = query.gte("created_at", filters.from);
    if (filters.to)        query = query.lte("created_at", filters.to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async findPublicCharge(id: string) {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .select("id, amount, description, due_date, status, psychologist_id, asaas_payment_id, asaas_invoice_url")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as {
      id: string;
      amount: number;
      description: string | null;
      due_date: string | null;
      status: string;
      psychologist_id: string;
      asaas_payment_id: string | null;
      asaas_invoice_url: string | null;
    } | null;
  }

  async findPatientAsaasCustomerId(patientId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("patients")
      .select("asaas_customer_id")
      .eq("id", patientId)
      .maybeSingle();
    if (error) throw error;
    return data?.asaas_customer_id ?? null;
  }

  async findPatientBasic(patientId: string): Promise<{ full_name: string; email: string; cpf: string | null } | null> {
    const { data, error } = await this.supabase
      .from("patients")
      .select("full_name, email, cpf")
      .eq("id", patientId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async savePatientAsaasCustomerId(patientId: string, customerId: string): Promise<void> {
    const { error } = await this.supabase
      .from("patients")
      .update({ asaas_customer_id: customerId })
      .eq("id", patientId);
    if (error) throw error;
  }

  async updateChargeAsaasPaymentId(chargeId: string, asaasPaymentId: string, invoiceUrl?: string): Promise<void> {
    const { error } = await this.supabase
      .from("financial_charges")
      .update({ asaas_payment_id: asaasPaymentId, ...(invoiceUrl ? { asaas_invoice_url: invoiceUrl } : {}) })
      .eq("id", chargeId);
    if (error) throw error;
  }

  async findChargeByAsaasPaymentId(asaasPaymentId: string): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .select("id")
      .eq("asaas_payment_id", asaasPaymentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateStatusById(chargeId: string, status: string, paidAt: string | null): Promise<void> {
    const { error } = await this.supabase
      .from("financial_charges")
      .update({ status, ...(paidAt ? { paid_at: paidAt } : {}) })
      .eq("id", chargeId);
    if (error) throw error;
  }

  async findChargeById(id: string, psychologistId: string) {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .select("*, patient:patients(id, full_name, email)")
      .eq("id", id)
      .eq("psychologist_id", psychologistId)
      .maybeSingle();
    if (error) throw error;
    return data as (FinancialCharge & { patient: { id: string; full_name: string; email: string } | null }) | null;
  }

  async createCharge(
    psychologistId: string,
    payload: Pick<FinancialCharge, "patient_id" | "session_id" | "amount" | "description" | "due_date" | "notes" | "billing_type">,
  ): Promise<FinancialCharge> {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .insert({ psychologist_id: psychologistId, ...payload, status: "pending" })
      .select("*, patient:patients(id, full_name)")
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, psychologistId: string, status: string): Promise<FinancialCharge> {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .update({
        status,
        paid_at:    status === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("psychologist_id", psychologistId)
      .select("*, patient:patients(id, full_name)")
      .single();
    if (error) throw error;

    if (status === "cancelled") {
      await this.supabase.from("sessions").update({ charge_id: null }).eq("charge_id", id);
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
    billingType?: BillingType;
  }): Promise<FinancialCharge> {
    const { data: charge, error: chargeError } = await this.supabase
      .from("financial_charges")
      .insert({
        psychologist_id: params.psychologistId,
        patient_id:      params.patientId,
        amount:          params.amount,
        description:     params.description,
        billing_type:    params.billingType ?? null,
        status:          "pending",
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
      query = query.gte("created_at", `${month}-01`).lte("created_at", `${month}-31`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const charges = data ?? [];
    return {
      received:      charges.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0),
      pending:       charges.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0),
      overdue:       charges.filter((c) => c.status === "overdue").reduce((s, c) => s + Number(c.amount), 0),
      total_charges: charges.length,
    };
  }

  async findPendingTransfers(): Promise<PendingTransfer[]> {
    const { data, error } = await this.supabase
      .from("financial_charges")
      .select("id, psychologist_id, amount, billing_type, paid_at")
      .eq("status", "paid")
      .is("transferred_at", null)
      .not("asaas_payment_id", "is", null);
    if (error) throw error;
    return (data ?? []).filter((c) => c.paid_at !== null) as PendingTransfer[];
  }

  async markTransferred(chargeId: string, transferId: string, transferAmount: number): Promise<void> {
    const { error } = await this.supabase
      .from("financial_charges")
      .update({ transfer_id: transferId, transferred_at: new Date().toISOString(), transfer_amount: transferAmount })
      .eq("id", chargeId);
    if (error) throw error;
  }
}
