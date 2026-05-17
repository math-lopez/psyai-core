import { z } from 'zod';

export const createClinicSchema = z.object({
  name: z.string().min(2).max(200),
  cnpj: z.string().max(20).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
});

export const updateClinicSchema = createClinicSchema.partial();

export const createMemberSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  full_name: z.string().min(2).max(200),
  role: z.enum(['admin', 'psychologist']).optional().default('psychologist'),
});

export const updateMemberSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export const registerClinicSchema = z.object({
  clinic_name: z.string().min(2).max(200),
  owner_name: z.string().min(2).max(200),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  cnpj: z.string().min(14, 'CNPJ inválido').max(20),
  phone: z.string().max(20).optional(),
});
