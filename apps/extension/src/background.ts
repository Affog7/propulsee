import { prefilterPage } from './lib/any-job-page';
import { JOB_SITE_INFO, detectJobSite, isJobSiteUrl } from './lib/job-sites';
import { readAnyPage } from './lib/read-any-offer';
import { hasAnySiteAccess } from './lib/site-access';

// Un clic sur l'icône de l'extension ouvre directement le panneau latéral.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error('[propulsee] setPanelBehavior', err));

const BADGE_COLOR = '#4f46e5';

function setBadge(tabId: number, title: string | null) {
  void chrome.action.setBadgeText({ tabId, text: title ? '✦' : '' });
  void chrome.action.setTitle({ tabId, title: title ?? 'Ouvrir Propulsee' });
}

/**
 * Hors des sites connus, le badge s'appuie sur le seul pré-filtre local : la page n'est pas
 * envoyée au LLM tant que l'utilisateur n'ouvre pas le panneau dessus.
 */
async function looksLikeOffer(tabId: number, url: string | undefined): Promise<boolean> {
  if (!url?.startsWith('https://') || isJobSiteUrl(url) || !(await hasAnySiteAccess())) {
    return false;
  }
  const page = await readAnyPage(tabId);
  return !!page && prefilterPage(page) !== 'unlikely';
}

/** Sur une offre, l'icône porte un badge : un clic suffit pour ouvrir l'assistant dessus. */
async function markTab(tabId: number, url: string | undefined, loaded: boolean) {
  const site = detectJobSite(url);
  if (site) {
    setBadge(tabId, `Offre ${JOB_SITE_INFO[site].label} détectée : préparer ma candidature`);
    return;
  }
  // La page n'est lisible qu'une fois chargée : en attendant, pas de badge.
  const likely = loaded && (await looksLikeOffer(tabId, url));
  setBadge(tabId, likely ? 'Offre détectée : préparer ma candidature' : null);
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'complete') {
    void markTab(tabId, tab.url, tab.status === 'complete');
  }
});

// Au démarrage (installation, mise à jour), on marque les offres déjà ouvertes.
void chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
void chrome.action.setBadgeTextColor({ color: '#ffffff' });
void chrome.tabs.query({}).then((tabs) => {
  for (const tab of tabs) {
    if (tab.id !== undefined) void markTab(tab.id, tab.url, tab.status === 'complete');
  }
});
