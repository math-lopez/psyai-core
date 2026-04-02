export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'ultra';

export interface PlanLimits {
  name: string;
  price: number;
  maxPatients: number;
  maxSessionsPerMonth: number;
  maxTranscriptionsPerMonth: number;
  hasTherapeuticInsights: boolean;
  description: string;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    name: 'Gratuito',
    price: 0,
    maxPatients: 3,
    maxSessionsPerMonth: 5,
    maxTranscriptionsPerMonth: 0,
    hasTherapeuticInsights: false,
    description: 'Ideal para experimentação e início de carreira.',
  },
  basic: {
    name: 'Básico',
    price: 12.9,
    maxPatients: 15,
    maxSessionsPerMonth: 30,
    maxTranscriptionsPerMonth: 5,
    hasTherapeuticInsights: false,
    description: 'Para profissionais que estão começando a crescer.',
  },
  pro: {
    name: 'Profissional',
    price: 21.9,
    maxPatients: 50,
    maxSessionsPerMonth: 200,
    maxTranscriptionsPerMonth: 30,
    hasTherapeuticInsights: false,
    description: 'Gestão completa para clínicas em ritmo acelerado.',
  },
  ultra: {
    name: 'Ultra',
    price: 45.9,
    maxPatients: Infinity,
    maxSessionsPerMonth: Infinity,
    maxTranscriptionsPerMonth: Infinity,
    hasTherapeuticInsights: true,
    description: 'Liberdade total e inteligência artificial avançada.',
  },
};
