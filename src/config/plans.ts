export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'ultra';

export const PLAN_LIMITS: Record<
  SubscriptionTier,
  { name: string; maxPatients: number }
> = {
  free: {
    name: 'Gratuito',
    maxPatients: 10,
  },
  basic: {
    name: 'Básico',
    maxPatients: 100,
  },
  pro: {
    name: 'Profissional',
    maxPatients: 1000,
  },
  ultra: {
    name: 'Ultra',
    maxPatients: Infinity,
  },
};
