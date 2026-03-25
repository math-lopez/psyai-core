export type SubscriptionTier = 'free' | 'basic' | 'pro';

export const PLAN_LIMITS: Record<
  SubscriptionTier,
  { name: string; maxPatients: number }
> = {
  free: {
    name: 'Free',
    maxPatients: 5,
  },
  basic: {
    name: 'Basic',
    maxPatients: 50,
  },
  pro: {
    name: 'Pro',
    maxPatients: 999999,
  },
};