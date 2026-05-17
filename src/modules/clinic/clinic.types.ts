export type ClinicSubscriptionTier = 'clinic_starter' | 'clinic_pro' | 'clinic_enterprise';
export type ClinicSubscriptionStatus = 'active' | 'suspended' | 'cancelled';
export type ClinicMemberRole = 'admin' | 'psychologist';
export type ClinicMemberStatus = 'active' | 'invited' | 'suspended';

export interface Clinic {
  id: string;
  name: string;
  owner_id: string;
  subscription_tier: ClinicSubscriptionTier;
  subscription_status: ClinicSubscriptionStatus;
  asaas_customer_id: string | null;
  asaas_api_key: string | null;
  cnpj: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicMember {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicMemberRole;
  status: ClinicMemberStatus;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicMemberWithProfile extends ClinicMember {
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface CreateClinicInput {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
}

export interface UpdateClinicInput {
  name?: string;
  cnpj?: string | null;
  phone?: string | null;
}

export interface CreateMemberInput {
  email: string;
  password: string;
  full_name: string;
  role?: ClinicMemberRole;
}

export interface UpdateMemberInput {
  status: ClinicMemberStatus;
}
