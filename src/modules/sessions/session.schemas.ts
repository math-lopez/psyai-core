import { z } from 'zod';

export const createSessionSchema = z.object({
  patient_id: z.string().uuid('patient_id inválido'),
  session_date: z.string().min(1, 'session_date é obrigatório'),
  duration_minutes: z.number().int().positive().optional(),
  record_type: z.string().nullable().optional(),
  manual_notes: z.string().nullable().optional(),
  additional_notes: z.string().nullable().optional(),
  clinical_notes: z.string().nullable().optional(),
  interventions: z.string().nullable().optional(),
  session_summary_manual: z.string().nullable().optional(),
  next_steps: z.string().nullable().optional(),
});

export const updateSessionSchema = createSessionSchema.partial();

export const createRecurrentSessionSchema = z.object({
  patient_id: z.string().uuid('patient_id inválido'),
  session_date: z.string().min(1, 'session_date é obrigatório'),
  until_date: z.string().min(1, 'until_date é obrigatório'),
  duration_minutes: z.number().int().positive().optional(),
  record_type: z.string().nullable().optional(),
  manual_notes: z.string().nullable().optional(),
  additional_notes: z.string().nullable().optional(),
  clinical_notes: z.string().nullable().optional(),
  interventions: z.string().nullable().optional(),
  session_summary_manual: z.string().nullable().optional(),
  next_steps: z.string().nullable().optional(),
});