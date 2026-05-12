export type SubscriptionTier = 'free' | 'pro';

export interface PlanLimits {
  name: string;
  price: number;
  priceYearly: number;
  maxPatients: number;
  maxSessionsPerMonth: number;
  maxVideoCallsPerMonth: number;
  maxTranscriptionsPerMonth: number;
  maxSynthesesPerMonth: number;
  hasTherapeuticInsights: boolean;
  hasFinancial: boolean;
  hasWhatsAppReminders: boolean;
  hasPsychologicalTests: boolean;
  storageGB: number;
  description: string;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    name: 'Iniciante',
    price: 0,
    priceYearly: 0,
    maxPatients: envInt('PLAN_FREE_MAX_PATIENTS', 3),
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: Infinity,
    maxTranscriptionsPerMonth: envInt('PLAN_FREE_MAX_TRANSCRIPTIONS', 3),
    maxSynthesesPerMonth: envInt('PLAN_FREE_MAX_SYNTHESES', 2),
    hasTherapeuticInsights: false,
    hasFinancial: false,
    hasWhatsAppReminders: false,
    hasPsychologicalTests: false,
    storageGB: 1,
    description: 'Para conhecer a plataforma e dar os primeiros passos.',
  },
  pro: {
    name: 'Profissional',
    price: 79,
    priceYearly: 67,
    maxPatients: Infinity,
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: Infinity,
    maxTranscriptionsPerMonth: envInt('PLAN_PRO_MAX_TRANSCRIPTIONS', 40),
    maxSynthesesPerMonth: envInt('PLAN_PRO_MAX_SYNTHESES', 30),
    hasTherapeuticInsights: true,
    hasFinancial: true,
    hasWhatsAppReminders: true,
    hasPsychologicalTests: true,
    storageGB: 20,
    description: 'Gestão completa com IA para psicólogos em crescimento.',
  },
};
