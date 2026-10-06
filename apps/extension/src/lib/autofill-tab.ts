import { collectFormFields, fillFormFields, type FieldFill } from './form-fields';
import type { FormField, FrameFill } from './autofill';

/**
 * Le formulaire de candidature peut être sur n'importe quel site (Greenhouse, Lever, site de
 * l'entreprise…) : l'accès est demandé une fois, au premier remplissage, pas à l'installation.
 */
export const FORM_SITES = ['https://*/*'];

/** Demande l'accès aux sites des formulaires. À appeler au clic : Chrome exige un geste. */
export function requestFormAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: FORM_SITES }).catch(() => false);
}

/** Onglet affiché à côté du panneau. */
export async function activeTabId(): Promise<number | null> {
  const win = await chrome.windows.getCurrent();
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return tab?.id ?? null;
}

/** Champs de tous les cadres de l'onglet : les formulaires sont souvent dans une iframe. */
export async function scanForm(tabId: number): Promise<FormField[]> {
  const frames = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: collectFormFields,
  });
  return frames.flatMap((frame) =>
    (frame.result ?? []).map((field) => ({ ...field, frameId: frame.frameId })),
  );
}

/** Remplit l'onglet, cadre par cadre ; renvoie le nombre de champs remplis. */
export async function fillForm(tabId: number, fills: FrameFill[]): Promise<number> {
  const byFrame = new Map<number, FieldFill[]>();
  for (const { frameId, fill } of fills) {
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), fill]);
  }
  const counts = await Promise.all(
    Array.from(byFrame, async ([frameId, frameFills]) => {
      const [frame] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: fillFormFields,
        args: [frameFills],
      });
      return frame?.result?.length ?? 0;
    }),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/** Octets d'un PDF en base64, seul format que `executeScript` sait transmettre. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
