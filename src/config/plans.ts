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

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    name: 'Iniciante',
    price: 0,
    priceYearly: 0,
    maxPatients: 3,
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: Infinity,
    maxTranscriptionsPerMonth: 3,
    maxSynthesesPerMonth: 2,
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
    maxTranscriptionsPerMonth: 40,
    maxSynthesesPerMonth: 30,
    hasTherapeuticInsights: true,
    hasFinancial: true,
    hasWhatsAppReminders: true,
    hasPsychologicalTests: true,
    storageGB: 20,
    description: 'Gestão completa com IA para psicólogos em crescimento.',
  },
};
