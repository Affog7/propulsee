import type { ApplicationStatus, SentApplication } from '@propulsee/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  forgetApplication,
  loadApplications,
  recordApplication,
  saveApplicationStatus,
} from '../lib/applications';

/** Suivi des candidatures : rempli tout seul à chaque envoi, sans saisie. */
export function useApplications() {
  const [list, setList] = useState<SentApplication[]>([]);

  useEffect(() => {
    let active = true;
    const reload = () =>
      void loadApplications().then((saved) => {
        if (active) setList(saved);
      });
    reload();
    // Un autre panneau (autre fenêtre) a pu envoyer une candidature.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && 'applications' in changes) reload();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const keep = useCallback((task: Promise<SentApplication[]>) => {
    void task.then(setList, () => undefined);
  }, []);

  const record = useCallback((sent: SentApplication) => keep(recordApplication(sent)), [keep]);
  const setStatus = useCallback(
    (url: string, status: ApplicationStatus) => keep(saveApplicationStatus(url, status)),
    [keep],
  );
  const forget = useCallback((url: string) => keep(forgetApplication(url)), [keep]);

  return { list, record, setStatus, forget };
}
