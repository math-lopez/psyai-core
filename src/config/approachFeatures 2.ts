export type TherapeuticApproach = 'TCC' | 'PSICANALISE' | 'HUMANISTA';

export interface AppFeatures {
  hasTherapeuticPlan: boolean;
  hasDiary: boolean;
  hasSessions: boolean;
  hasFiles: boolean;
}

export const APPROACH_FEATURES: Record<TherapeuticApproach, AppFeatures> = {
  TCC: {
    hasTherapeuticPlan: true,
    hasDiary: true,
    hasSessions: true,
    hasFiles: true,
  },
  PSICANALISE: {
    hasTherapeuticPlan: false,
    hasDiary: false,
    hasSessions: true,
    hasFiles: true,
  },
  HUMANISTA: {
    hasTherapeuticPlan: false,
    hasDiary: false,
    hasSessions: true,
    hasFiles: true,
  },
};
