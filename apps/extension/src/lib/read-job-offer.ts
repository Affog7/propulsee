import type { JobOffer } from '@propulsee/shared';
import { collectJobPage } from './collect-job-page';
import { buildJobOffer } from './job-offer';
import { JOB_SITE_INFO, type JobSite } from './job-sites';

/** Les sites d'offres affichent l'offre après le chargement : on relit la page un moment. */
const ATTEMPTS = 8;
const RETRY_DELAY_MS = 500;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  });
}

async function readOnce(tabId: number, site: JobSite): Promise<JobOffer | null> {
  try {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectJobPage,
      args: [JOB_SITE_INFO[site].selectors],
    });
    return frame?.result ? buildJobOffer(frame.result) : null;
  } catch {
    // Onglet fermé, en cours de navigation ou page d'erreur : on réessaie.
    return null;
  }
}

/** Offre affichée dans l'onglet `tabId`, ou `null` si la page n'en montre pas. */
export async function readJobOffer(
  tabId: number,
  site: JobSite,
  signal: AbortSignal,
): Promise<JobOffer | null> {
  for (let attempt = 0; attempt < ATTEMPTS && !signal.aborted; attempt++) {
    if (attempt > 0) await wait(RETRY_DELAY_MS, signal);
    const offer = await readOnce(tabId, site);
    if (offer && !signal.aborted) return offer;
  }
  return null;
}
