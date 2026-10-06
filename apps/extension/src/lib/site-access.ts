/**
 * Accès à tous les sites, facultatif (`optional_host_permissions`) : demandé une fois, au clic,
 * pour détecter une offre hors des sites connus ou remplir un formulaire de candidature
 * (Greenhouse, site de l'entreprise…). Rien n'est demandé à l'installation.
 */
export const ANY_SITE = ['https://*/*'];

export function hasAnySiteAccess(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ANY_SITE }).catch(() => false);
}

/** À appeler au clic : Chrome exige un geste de l'utilisateur. */
export function requestAnySiteAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: ANY_SITE }).catch(() => false);
}
