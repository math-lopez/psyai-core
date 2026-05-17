import { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateClinicInput,
  UpdateClinicInput,
  ClinicMemberRole,
  ClinicMemberStatus,
} from './clinic.types';

export class ClinicRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByOwnerId(ownerId: string) {
    const { data, error } = await this.supabase
      .from('clinics')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByMemberId(userId: string) {
    const { data, error } = await this.supabase
      .from('clinic_members')
      .select('clinic_id, role, clinics(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findById(clinicId: string) {
    const { data, error } = await this.supabase
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(ownerId: string, payload: CreateClinicInput) {
    const { data, error } = await this.supabase
      .from('clinics')
      .insert({ ...payload, owner_id: ownerId })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async update(clinicId: string, payload: UpdateClinicInput) {
    const { data, error } = await this.supabase
      .from('clinics')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', clinicId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async listMembers(clinicId: string) {
    const { data: members, error } = await this.supabase
      .from('clinic_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!members?.length) return [];

    const userIds = members.map((m: any) => m.user_id);
    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
      .then((res) => ({ data: res.data ?? [] }))
      .catch(() => ({ data: [] }));

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return members.map((m: any) => ({
      ...m,
      profiles: profileMap.get(m.user_id) ?? null,
    }));
  }

  async findMember(clinicId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('clinic_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findMemberById(memberId: string) {
    const { data, error } = await this.supabase
      .from('clinic_members')
      .select('*')
      .eq('id', memberId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async addMember(clinicId: string, userId: string, role: ClinicMemberRole, invitedBy: string) {
    const { data, error } = await this.supabase
      .from('clinic_members')
      .insert({
        clinic_id: clinicId,
        user_id: userId,
        role,
        status: 'active',
        invited_by: invitedBy,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async updateMemberStatus(memberId: string, status: ClinicMemberStatus) {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'suspended') patch.suspended_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('clinic_members')
      .update(patch)
      .eq('id', memberId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async listClinicPatients(clinicId: string) {
    const { data: members, error: membersError } = await this.supabase
      .from('clinic_members')
      .select('user_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'active');

    if (membersError) throw membersError;
    if (!members?.length) return [];

    const psychologistIds = members.map((m: any) => m.user_id);

    const { data: patients, error } = await this.supabase
      .from('patients')
      .select('*')
      .in('psychologist_id', psychologistIds)
      .order('full_name', { ascending: true });

    if (error) throw error;
    if (!patients?.length) return [];

    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', psychologistIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return patients.map((p: any) => ({
      ...p,
      psychologist: profileMap.get(p.psychologist_id) ?? null,
    }));
  }

  async getClinicStats(clinicId: string) {
    const { data: members } = await this.supabase
      .from('clinic_members')
      .select('user_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'active');

    const psychologistIds = (members ?? []).map((m: any) => m.user_id);
    if (!psychologistIds.length) return { totalPatients: 0, totalSessions: 0, pendingSessions: 0, completedSessions: 0, totalPsychologists: 0 };

    const [
      { count: totalPatients },
      { count: totalSessions },
      { count: pendingSessions },
      { count: completedSessions },
    ] = await Promise.all([
      this.supabase.from('patients').select('*', { count: 'exact', head: true }).in('psychologist_id', psychologistIds),
      this.supabase.from('sessions').select('*', { count: 'exact', head: true }).in('psychologist_id', psychologistIds),
      this.supabase.from('sessions').select('*', { count: 'exact', head: true }).in('psychologist_id', psychologistIds).eq('status', 'scheduled'),
      this.supabase.from('sessions').select('*', { count: 'exact', head: true }).in('psychologist_id', psychologistIds).eq('status', 'completed'),
    ]);

    return {
      totalPatients: totalPatients ?? 0,
      totalSessions: totalSessions ?? 0,
      pendingSessions: pendingSessions ?? 0,
      completedSessions: completedSessions ?? 0,
      totalPsychologists: psychologistIds.length,
    };
  }

  async transferPatient(patientId: string, newPsychologistId: string) {
    await this.supabase.from('patients').update({ psychologist_id: newPsychologistId }).eq('id', patientId);
    await this.supabase.from('sessions').update({ psychologist_id: newPsychologistId }).eq('patient_id', patientId);
    await this.supabase.from('patient_access').update({ psychologist_id: newPsychologistId }).eq('patient_id', patientId);
    await this.supabase.from('financial_charges').update({ psychologist_id: newPsychologistId }).eq('patient_id', patientId);
  }

  async getClinicFinancial(clinicId: string) {
    const { data: members, error: membersError } = await this.supabase
      .from('clinic_members')
      .select('user_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'active');

    if (membersError) throw membersError;
    if (!members?.length) return [];

    const psychologistIds = members.map((m: any) => m.user_id);

    const { data: charges, error } = await this.supabase
      .from('financial_charges')
      .select('*, patient:patients(id, full_name)')
      .in('psychologist_id', psychologistIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', psychologistIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Agrupa cobranças por psicólogo
    const grouped: Record<string, { psychologist: any; charges: any[]; summary: { received: number; pending: number; overdue: number; total: number } }> = {};

    for (const charge of charges ?? []) {
      const pid = charge.psychologist_id;
      if (!grouped[pid]) {
        grouped[pid] = {
          psychologist: profileMap.get(pid) ?? { id: pid, full_name: null, email: null },
          charges: [],
          summary: { received: 0, pending: 0, overdue: 0, total: 0 },
        };
      }
      grouped[pid].charges.push(charge);
      grouped[pid].summary.total += charge.amount;
      if (charge.status === 'paid') grouped[pid].summary.received += charge.amount;
      else if (charge.status === 'pending') grouped[pid].summary.pending += charge.amount;
      else if (charge.status === 'overdue') grouped[pid].summary.overdue += charge.amount;
    }

    return Object.values(grouped);
  }

  async removeMember(memberId: string) {
    const { error } = await this.supabase
      .from('clinic_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  }

  async countActiveMembers(clinicId: string) {
    const { count, error } = await this.supabase
      .from('clinic_members')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'active');

    if (error) throw error;
    return count ?? 0;
  }
}
