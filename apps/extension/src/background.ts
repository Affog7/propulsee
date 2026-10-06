import { JOB_SITE_INFO, detectJobSite } from './lib/job-sites';

// Un clic sur l'icône de l'extension ouvre directement le panneau latéral.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error('[propulsee] setPanelBehavior', err));

const BADGE_COLOR = '#4f46e5';

/** Sur une offre, l'icône porte un badge : un clic suffit pour ouvrir l'assistant dessus. */
function markTab(tabId: number, url: string | undefined) {
  const site = detectJobSite(url);
  void chrome.action.setBadgeText({ tabId, text: site ? '✦' : '' });
  void chrome.action.setTitle({
    tabId,
    title: site
      ? `Offre ${JOB_SITE_INFO[site].label} détectée : préparer ma candidature`
      : 'Ouvrir Propulsee',
  });
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'complete') markTab(tabId, tab.url);
});

// Au démarrage (installation, mise à jour), on marque les offres déjà ouvertes.
void chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
void chrome.action.setBadgeTextColor({ color: '#ffffff' });
void chrome.tabs.query({}).then((tabs) => {
  for (const tab of tabs) if (tab.id !== undefined) markTab(tab.id, tab.url);
});
