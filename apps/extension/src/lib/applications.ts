import {
  addApplication,
  normalizeApplications,
  removeApplication,
  setApplicationStatus,
  type ApplicationStatus,
  type SentApplication,
  type SentFile,
} from '@propulsee/shared';
import { downloadPdf } from './pdf-render';

const STORAGE_KEY = 'applications';

/** Candidatures envoyées, la plus récente en tête. */
export async function loadApplications(): Promise<SentApplication[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeApplications(stored[STORAGE_KEY]);
}

async function change(
  update: (list: SentApplication[]) => SentApplication[],
): Promise<SentApplication[]> {
  const list = update(await loadApplications());
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
  return list;
}

export function recordApplication(sent: SentApplication): Promise<SentApplication[]> {
  return change((list) => addApplication(list, sent));
}

export function saveApplicationStatus(
  url: string,
  status: ApplicationStatus,
): Promise<SentApplication[]> {
  return change((list) => setApplicationStatus(list, url, status));
}

export function forgetApplication(url: string): Promise<SentApplication[]> {
  return change((list) => removeApplication(list, url));
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Retélécharge le PDF exact qui a été joint au formulaire. */
export function downloadSentFile(file: SentFile): void {
  downloadPdf(fromBase64(file.base64), file.name);
}
