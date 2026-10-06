import type { JobOffer } from '@propulsee/shared';
import { useEffect, useState } from 'react';
import { postingOffer, prefilterPage } from '../lib/any-job-page';
import { JOB_SITE_INFO, detectJobSite, isJobSiteUrl } from '../lib/job-sites';
import { loadLlmSettings } from '../lib/llm';
import { confirmOffer, readAnyPage } from '../lib/read-any-offer';
import { readJobOffer } from '../lib/read-job-offer';
import { hasAnySiteAccess } from '../lib/site-access';

export type ActiveJobOffer =
  /**
   * Pas d'offre dans l'onglet actif. `anySite` : la détection marche aussi hors des sites
   * connus (accès à tous les sites accordé).
   */
  | { status: 'none'; anySite: boolean }
  /** `source` : nom du site connu (« LinkedIn ») ou domaine de la page (« careers.acme.com »). */
  | { status: 'reading'; source: string }
  | { status: 'found'; source: string; offer: JobOffer }
  /** Site connu, mais aucune offre lisible (page de connexion, liste sans offre ouverte…). */
  | { status: 'missing'; source: string };

/**
 * Délai avant de lire la page après un changement d'URL : LinkedIn et Indeed changent d'offre
 * sans recharger la page, et l'URL change avant le contenu.
 */
const NAVIGATION_DELAY_MS = 400;

/** Hors des sites connus, la page peut afficher l'offre après son chargement : on la relit. */
const ANY_PAGE_ATTEMPTS = 3;
const ANY_PAGE_RETRY_DELAY_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Onglet en cours d'inspection. `asking` : le LLM est interrogé, on ne relance pas. */
interface Entry {
  tabId: number;
  url: string | undefined;
  found: boolean;
  asking: boolean;
}

function hostLabel(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** Offre de l'onglet actif, suivie quand l'utilisateur change d'onglet ou d'offre. */
export function useActiveJobOffer(): ActiveJobOffer {
  const [state, setState] = useState<ActiveJobOffer>({ status: 'none', anySite: false });

  useEffect(() => {
    // Offres déjà lues : revenir sur un onglet les réaffiche sans attendre.
    const cache = new Map<string, JobOffer>();
    // Pages que le LLM a écartées : on ne lui renvoie pas.
    const rejected = new Set<string>();
    let current: Entry | null = null;
    let reading: AbortController | null = null;
    let windowId: number | undefined;
    let anySite = false;

    /** Site d'offres connu : règles propres au site, sans LLM. */
    async function inspectJobSite(
      tabId: number,
      url: string,
      entry: Entry,
      signal: AbortSignal,
      delay: number,
    ) {
      const site = detectJobSite(url);
      if (!site) return;
      const source = JOB_SITE_INFO[site].label;
      setState({ status: 'reading', source });
      if (delay) await wait(delay);
      const offer = await readJobOffer(tabId, site, signal);
      if (signal.aborted) return;
      if (offer) {
        cache.set(url, offer);
        entry.found = true;
      }
      setState(offer ? { status: 'found', source, offer } : { status: 'missing', source });
    }

    /**
     * N'importe quel autre site : un pré-filtre local (JSON-LD, mots d'une fiche de poste, bouton
     * « Postuler ») décide si la page vaut d'être montrée au LLM, qui confirme et lit l'en-tête.
     * Les autres pages ne quittent pas le navigateur.
     */
    async function inspectAnyPage(
      tabId: number,
      url: string,
      entry: Entry,
      signal: AbortSignal,
      delay: number,
    ) {
      setState({ status: 'none', anySite });
      if (!anySite || rejected.has(url)) return;
      if (delay) await wait(delay);
      for (let attempt = 0; attempt < ANY_PAGE_ATTEMPTS && !signal.aborted; attempt++) {
        if (attempt > 0) await wait(ANY_PAGE_RETRY_DELAY_MS);
        const page = await readAnyPage(tabId);
        if (!page || signal.aborted) return;
        const verdict = prefilterPage(page);
        if (verdict === 'unlikely') continue;

        let offer: JobOffer | null;
        if (verdict === 'posting') {
          offer = postingOffer(page);
        } else {
          const llm = await loadLlmSettings();
          if (!llm || signal.aborted) return;
          setState({ status: 'reading', source: hostLabel(url) });
          entry.asking = true;
          offer = await confirmOffer(llm, page, signal);
          entry.asking = false;
          if (signal.aborted) return;
          if (!offer) rejected.add(url);
        }
        if (offer) {
          cache.set(url, offer);
          entry.found = true;
          setState({ status: 'found', source: hostLabel(url), offer });
        } else {
          setState({ status: 'none', anySite });
        }
        return;
      }
    }

    async function inspect(tab: chrome.tabs.Tab | undefined, { delay = 0, force = false } = {}) {
      if (tab?.id === undefined) return;
      const { id: tabId, url } = tab;
      if (!force && current?.tabId === tabId && current.url === url) return;
      const entry: Entry = { tabId, url, found: false, asking: false };
      current = entry;
      reading?.abort();
      const controller = new AbortController();
      reading = controller;

      if (!url?.startsWith('https://')) {
        setState({ status: 'none', anySite });
        return;
      }
      const cached = cache.get(url);
      if (cached) {
        entry.found = true;
        const site = detectJobSite(url);
        setState({
          status: 'found',
          source: site ? JOB_SITE_INFO[site].label : hostLabel(url),
          offer: cached,
        });
        return;
      }
      if (detectJobSite(url)) {
        await inspectJobSite(tabId, url, entry, controller.signal, delay);
      } else if (isJobSiteUrl(url)) {
        // Site connu hors d'une offre (fil LinkedIn…) : ses règles disent déjà qu'il n'y en a pas.
        setState({ status: 'none', anySite });
      } else {
        await inspectAnyPage(tabId, url, entry, controller.signal, delay);
      }
    }

    async function inspectActiveTab() {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      await inspect(tab, { force: true });
    }

    const onActivated = ({ tabId, windowId: win }: chrome.tabs.OnActivatedInfo) => {
      if (win === windowId) void chrome.tabs.get(tabId).then((tab) => inspect(tab));
    };
    const onUpdated = (tabId: number, change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (!tab.active || tab.windowId !== windowId) return;
      if (change.url) void inspect(tab, { delay: NAVIGATION_DELAY_MS });
      // Fin de chargement d'une page où l'offre n'était pas encore lisible : on relit.
      else if (
        change.status === 'complete' &&
        current?.tabId === tabId &&
        !current.found &&
        !current.asking
      ) {
        void inspect(tab, { force: true });
      }
    };
    // Accès à tous les sites accordé (ici ou au premier remplissage) ou retiré : on relit l'onglet.
    const onPermissionsChanged = () => {
      void hasAnySiteAccess().then((granted) => {
        anySite = granted;
        void inspectActiveTab();
      });
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.permissions.onAdded.addListener(onPermissionsChanged);
    chrome.permissions.onRemoved.addListener(onPermissionsChanged);
    void Promise.all([chrome.windows.getCurrent(), hasAnySiteAccess()]).then(
      async ([win, granted]) => {
        windowId = win.id;
        anySite = granted;
        await inspectActiveTab();
      },
    );

    return () => {
      reading?.abort();
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.permissions.onAdded.removeListener(onPermissionsChanged);
      chrome.permissions.onRemoved.removeListener(onPermissionsChanged);
    };
  }, []);

  return state;
}
