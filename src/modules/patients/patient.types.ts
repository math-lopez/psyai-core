export type PatientStatus = 'ativo' | 'inativo';

export interface Patient {
  id: string;
  psychologist_id: string;
  full_name: string;
  birth_date: string;
  cpf: string | null;
  phone: string;
  email: string;
  gender: string | null;
  notes: string | null;
  status: PatientStatus | null;
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientInput {
  full_name: string;
  birth_date: string;
  cpf?: string | null;
  phone: string;
  email: string;
  gender?: string | null;
  notes?: string | null;
  status?: PatientStatus | null;
  emergency_contact?: string | null;
}

export interface UpdatePatientInput {
  full_name?: string;
  birth_date?: string;
  cpf?: string | null;
  phone?: string;
  email?: string;
  gender?: string | null;
  notes?: string | null;
  status?: PatientStatus | null;
  emergency_contact?: string | null;
}