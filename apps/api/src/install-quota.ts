/** Nombre de requêtes LLM par installation et par jour, offert par défaut. */
export const DEFAULT_LLM_DAILY_LIMIT = 200;

/** Compte les requêtes LLM de chaque installation, remis à zéro chaque jour (UTC). */
export interface InstallQuota {
  /** Décompte une requête ; `false` si la limite du jour est déjà atteinte. */
  take(installId: string): boolean;
}

export function createInstallQuota(
  limit = DEFAULT_LLM_DAILY_LIMIT,
  now: () => Date = () => new Date(),
): InstallQuota {
  let day = '';
  let counts = new Map<string, number>();
  return {
    take(installId) {
      const today = now().toISOString().slice(0, 10);
      if (today !== day) {
        // Nouveau jour : on oublie les compteurs de la veille (la mémoire reste bornée).
        day = today;
        counts = new Map();
      }
      const used = counts.get(installId) ?? 0;
      if (used >= limit) return false;
      counts.set(installId, used + 1);
      return true;
    },
  };
}
