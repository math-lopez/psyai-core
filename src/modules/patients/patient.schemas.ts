import { z } from 'zod';

export const createPatientSchema = z.object({
  full_name: z.string().min(2).max(200),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(8).max(20),
  cpf: z.string().max(20).nullable().optional(),
  gender: z.string().max(30).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['ativo', 'inativo']).nullable().optional(),
  emergency_contact: z.string().max(200).nullable().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();
