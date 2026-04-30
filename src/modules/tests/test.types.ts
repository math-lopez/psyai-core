import { z } from 'zod';

// ── Options ──────────────────────────────────────────────────────────────────

export const LikertOptionSchema = z.object({
  label: z.string(),
  value: z.number(),
});

// ── Questions ─────────────────────────────────────────────────────────────────

export const CreateQuestionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['likert', 'yes_no']),
  order_index: z.number().int().min(0),
  options: z.array(LikertOptionSchema).min(2),
});

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

// ── Scoring config ────────────────────────────────────────────────────────────

export const ScoreRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string(),
});

export const SubscaleSchema = z.object({
  name: z.string(),
  question_ids: z.array(z.string().uuid()),
  ranges: z.array(ScoreRangeSchema).optional(),
});

export const ScoringConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sum'),       total_ranges: z.array(ScoreRangeSchema).optional() }),
  z.object({ type: z.literal('average'),   total_ranges: z.array(ScoreRangeSchema).optional() }),
  z.object({ type: z.literal('subscales'), subscales: z.array(SubscaleSchema), total_ranges: z.array(ScoreRangeSchema).optional() }),
]);

export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;

// ── Templates ─────────────────────────────────────────────────────────────────

export const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  scoring_config: ScoringConfigSchema,
  questions: z.array(CreateQuestionSchema).min(1),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

export const UpdateTemplateSchema = CreateTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;

// ── Applications ──────────────────────────────────────────────────────────────

export const CreateApplicationSchema = z.object({
  template_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;

// ── Submission (patient answers) ──────────────────────────────────────────────

export const AnswerSchema = z.object({
  question_id: z.string().uuid(),
  value: z.union([z.number(), z.boolean()]),
});

export const SubmitTestSchema = z.object({
  answers: z.array(AnswerSchema).min(1),
});

export type SubmitTestInput = z.infer<typeof SubmitTestSchema>;
