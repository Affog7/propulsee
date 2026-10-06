import { cvFileName, type JobOffer, type TailoredCv } from '@propulsee/shared';
import { useState } from 'react';
import { downloadCvPdf } from '../lib/cv-pdf';

/** Export PDF du CV adapté, en un clic. */
export function useCvDownload(): {
  busy: boolean;
  error: string | null;
  download: (tailored: TailoredCv, offer: JobOffer) => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function download(tailored: TailoredCv, offer: JobOffer) {
    if (busy) return;
    setBusy(true);
    setError(null);
    downloadCvPdf(tailored, cvFileName(tailored.cv.fullName, offer.company))
      .catch(() => setError('Je n’ai pas réussi à créer le PDF. Réessayez.'))
      .finally(() => setBusy(false));
  }

  return { busy, error, download };
}
