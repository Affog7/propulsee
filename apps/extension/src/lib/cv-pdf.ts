import type { TailoredCv } from '@propulsee/shared';
import { layoutCv, sanitizeCv } from './cv-layout';
import { downloadPdf, renderPdf } from './pdf-render';

/** Génère le PDF du CV adapté. */
export function buildCvPdf(tailored: TailoredCv): Promise<Uint8Array> {
  return renderPdf(
    {
      title: tailored.cv.fullName ? `CV · ${tailored.cv.fullName}` : 'CV',
      author: tailored.cv.fullName || undefined,
    },
    (measure, isSupported) =>
      layoutCv(sanitizeCv(tailored.cv, isSupported), tailored.lang, measure),
  );
}

/** Télécharge le CV adapté en PDF, sous le nom `fileName`. */
export async function downloadCvPdf(tailored: TailoredCv, fileName: string): Promise<void> {
  downloadPdf(await buildCvPdf(tailored), fileName);
}
