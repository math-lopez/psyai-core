import { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, SubscriptionTier } from '../config/plans';

export async function resolveSubscriptionTier(
  supabase: SupabaseClient,
  psychologistId: string,
  clinicId?: string,
): Promise<SubscriptionTier> {
  if (clinicId) {
    const { data } = await supabase
      .from('clinics')
      .select('subscription_tier')
      .eq('id', clinicId)
      .maybeSingle();

    const tier = data?.subscription_tier as SubscriptionTier;
    return PLAN_LIMITS[tier] ? tier : 'clinic_starter';
  }

  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', psychologistId)
    .maybeSingle();

  const tier = data?.subscription_tier as SubscriptionTier;
  return PLAN_LIMITS[tier] ? tier : 'free';
}
