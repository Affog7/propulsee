import {
  JOB_DETECTION_MAX_TOKENS,
  buildJobDetectionPrompt,
  parseJobDetectionResponse,
  type JobOffer,
  type LlmSettings,
} from '@propulsee/shared';
import { detectedOffer, detectionPage } from './any-job-page';
import { collectAnyPage, type RawAnyPage } from './collect-any-page';
import { complete } from './llm';

/** Texte lu sur la page : assez pour l'offre et le pré-filtre, sans recopier une page géante. */
const PAGE_TEXT_MAX_LENGTH = 30_000;

/** Lit la page de l'onglet `tabId` ; `null` si Chrome refuse (page interne, accès retiré…). */
export async function readAnyPage(tabId: number): Promise<RawAnyPage | null> {
  try {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectAnyPage,
      args: [PAGE_TEXT_MAX_LENGTH],
    });
    return frame?.result ?? null;
  } catch {
    return null;
  }
}

/**
 * Demande au LLM si la page, retenue par le pré-filtre, est bien une offre, et en tire son
 * en-tête. `null` si ce n'en est pas une ou si le LLM ne répond pas.
 */
export async function confirmOffer(
  settings: LlmSettings,
  page: RawAnyPage,
  signal?: AbortSignal,
): Promise<JobOffer | null> {
  const result = await complete(settings, buildJobDetectionPrompt(detectionPage(page)), {
    maxTokens: JOB_DETECTION_MAX_TOKENS,
    signal,
  });
  if (!result.ok) return null;
  const detection = parseJobDetectionResponse(result.value);
  return detection?.isJobOffer ? detectedOffer(page, detection) : null;
}
