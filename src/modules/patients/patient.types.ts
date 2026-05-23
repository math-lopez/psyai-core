export type PatientStatus = 'ativo' | 'inativo';

export interface Guardian {
  id: string;
  patient_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGuardianInput {
  full_name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
}

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
  guardians?: Guardian[];
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
  guardians?: CreateGuardianInput[];
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
  guardians?: CreateGuardianInput[];
}