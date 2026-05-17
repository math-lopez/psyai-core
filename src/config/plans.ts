export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'ultra' | 'clinic_starter' | 'clinic_pro' | 'clinic_enterprise';

export interface PlanLimits {
  name: string;
  price: number;
  maxPatients: number;
  maxSessionsPerMonth: number;
  maxVideoCallsPerMonth: number;
  maxTranscriptionsPerMonth: number;
  maxSynthesesPerMonth: number;
  hasTherapeuticInsights: boolean;
  description: string;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    name: 'Gratuito',
    price: 0,
    maxPatients: 3,
    maxSessionsPerMonth: 5,
    maxVideoCallsPerMonth: 0,
    maxTranscriptionsPerMonth: 0,
    maxSynthesesPerMonth: 0,
    hasTherapeuticInsights: false,
    description: 'Ideal para experimentação e início de carreira.',
  },
  basic: {
    name: 'Básico',
    price: 12.9,
    maxPatients: 7,
    maxSessionsPerMonth: 28,
    maxVideoCallsPerMonth: 5,
    maxTranscriptionsPerMonth: 5,
    maxSynthesesPerMonth: 0,
    hasTherapeuticInsights: false,
    description: 'Para profissionais que estão começando a crescer.',
  },
  pro: {
    name: 'Profissional',
    price: 21.9,
    maxPatients: 12,
    maxSessionsPerMonth: 50,
    maxVideoCallsPerMonth: 30,
    maxTranscriptionsPerMonth: 30,
    maxSynthesesPerMonth: 10,
    hasTherapeuticInsights: true,
    description: 'Gestão completa para clínicas em ritmo acelerado.',
  },
  ultra: {
    name: 'Ultra',
    price: 45.9,
    maxPatients: Infinity,
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: Infinity,
    maxTranscriptionsPerMonth: Infinity,
    maxSynthesesPerMonth: 50,
    hasTherapeuticInsights: true,
    description: 'Liberdade total e inteligência artificial avançada.',
  },
  clinic_starter: {
    name: 'Clínica Starter',
    price: 0,
    maxPatients: Infinity,
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: 30,
    maxTranscriptionsPerMonth: 30,
    maxSynthesesPerMonth: 10,
    hasTherapeuticInsights: true,
    description: 'Para clínicas com até 3 psicólogos.',
  },
  clinic_pro: {
    name: 'Clínica Pro',
    price: 0,
    maxPatients: Infinity,
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: Infinity,
    maxTranscriptionsPerMonth: Infinity,
    maxSynthesesPerMonth: 50,
    hasTherapeuticInsights: true,
    description: 'Para clínicas com até 10 psicólogos.',
  },
  clinic_enterprise: {
    name: 'Clínica Enterprise',
    price: 0,
    maxPatients: Infinity,
    maxSessionsPerMonth: Infinity,
    maxVideoCallsPerMonth: Infinity,
    maxTranscriptionsPerMonth: Infinity,
    maxSynthesesPerMonth: Infinity,
    hasTherapeuticInsights: true,
    description: 'Para clínicas sem limite de psicólogos.',
  },
};
