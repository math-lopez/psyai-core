-- Migrate existing basic and ultra subscribers to pro
UPDATE profiles
  SET subscription_tier = 'pro'
  WHERE subscription_tier IN ('basic', 'ultra');

-- Enforce only valid tiers going forward
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro'));
