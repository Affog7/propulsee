/** Étapes du flux Copilot, dans l'ordre où l'utilisateur les parcourt. */
export const APPLICATION_STEPS = ['prepare', 'verify', 'apply'] as const;

export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

export const STEP_LABELS: Record<ApplicationStep, string> = {
  prepare: 'Préparer',
  verify: 'Vérifier',
  apply: 'Postuler',
};

/** Étape suivante, ou `null` si `step` est la dernière. */
export function nextStep(step: ApplicationStep): ApplicationStep | null {
  return APPLICATION_STEPS[APPLICATION_STEPS.indexOf(step) + 1] ?? null;
}
