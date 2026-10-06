import { useState } from 'react';

/** Export d'un document en PDF, en un clic : un seul à la fois, erreur affichable. */
export function useDownload(): {
  busy: boolean;
  error: string | null;
  download: (task: () => Promise<void>) => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function download(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    task()
      .catch(() => setError('Je n’ai pas réussi à créer le PDF. Réessayez.'))
      .finally(() => setBusy(false));
  }

  return { busy, error, download };
}
