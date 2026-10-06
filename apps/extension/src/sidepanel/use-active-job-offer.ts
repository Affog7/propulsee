import type { JobOffer } from '@propulsee/shared';
import { useEffect, useState } from 'react';
import { detectJobSite, type JobSite } from '../lib/job-sites';
import { readJobOffer } from '../lib/read-job-offer';

export type ActiveJobOffer =
  /** L'onglet actif n'est pas une offre d'un site reconnu. */
  | { status: 'none' }
  | { status: 'reading'; site: JobSite }
  | { status: 'found'; site: JobSite; offer: JobOffer }
  /** Site reconnu, mais aucune offre lisible (page de connexion, liste sans offre ouverte…). */
  | { status: 'missing'; site: JobSite };

/**
 * Délai avant de lire la page après un changement d'URL : LinkedIn et Indeed changent d'offre
 * sans recharger la page, et l'URL change avant le contenu.
 */
const NAVIGATION_DELAY_MS = 400;

/** Offre de l'onglet actif, suivie quand l'utilisateur change d'onglet ou d'offre. */
export function useActiveJobOffer(): ActiveJobOffer {
  const [state, setState] = useState<ActiveJobOffer>({ status: 'none' });

  useEffect(() => {
    // Offres déjà lues : revenir sur un onglet les réaffiche sans attendre.
    const cache = new Map<string, JobOffer>();
    let current: { tabId: number; url: string | undefined; found: boolean } | null = null;
    let reading: AbortController | null = null;
    let windowId: number | undefined;

    async function inspect(tab: chrome.tabs.Tab | undefined, { delay = 0, force = false } = {}) {
      if (tab?.id === undefined) return;
      const { id: tabId, url } = tab;
      if (!force && current?.tabId === tabId && current.url === url) return;
      const entry = { tabId, url, found: false };
      current = entry;
      reading?.abort();
      const controller = new AbortController();
      reading = controller;

      const site = detectJobSite(url);
      if (!site || !url) {
        setState({ status: 'none' });
        return;
      }
      const cached = cache.get(url);
      if (cached) {
        entry.found = true;
        setState({ status: 'found', site, offer: cached });
        return;
      }
      setState({ status: 'reading', site });
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const offer = await readJobOffer(tabId, site, controller.signal);
      if (controller.signal.aborted) return;
      if (offer) {
        cache.set(url, offer);
        entry.found = true;
      }
      setState(offer ? { status: 'found', site, offer } : { status: 'missing', site });
    }

    const onActivated = ({ tabId, windowId: win }: chrome.tabs.OnActivatedInfo) => {
      if (win === windowId) void chrome.tabs.get(tabId).then((tab) => inspect(tab));
    };
    const onUpdated = (tabId: number, change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (!tab.active || tab.windowId !== windowId) return;
      if (change.url) void inspect(tab, { delay: NAVIGATION_DELAY_MS });
      // Fin de chargement d'une page où l'offre n'était pas encore lisible : on relit.
      else if (change.status === 'complete' && current?.tabId === tabId && !current.found) {
        void inspect(tab, { force: true });
      }
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.windows.getCurrent().then(async (win) => {
      windowId = win.id;
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      await inspect(tab);
    });

    return () => {
      reading?.abort();
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return state;
}
