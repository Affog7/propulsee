import type { TailoredCv } from '@propulsee/shared';
import { PAGE_HEIGHT, PAGE_WIDTH, layoutCv, sanitizeCv, type CvTone } from './cv-layout';

/** Couleurs du CV, proches de l'aperçu affiché dans le panneau. */
const TONES: Record<CvTone, [number, number, number]> = {
  ink: [0.067, 0.067, 0.078],
  body: [0.2, 0.2, 0.23],
  muted: [0.47, 0.47, 0.52],
  accent: [0.149, 0.188, 0.42],
};
const RULE_COLOR: [number, number, number] = [0.898, 0.898, 0.918];

/** Génère le PDF du CV adapté. pdf-lib est chargé à la demande, au premier export. */
export async function buildCvPdf(tailored: TailoredCv): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const charset = new Set(fonts.regular.getCharacterSet());
  const cv = sanitizeCv(tailored.cv, (code) => charset.has(code));
  const layout = layoutCv(cv, tailored.lang, (text, size, font) =>
    fonts[font].widthOfTextAtSize(text, size),
  );

  const pages = Array.from({ length: layout.pages }, () => doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  for (const op of layout.ops) {
    const page = pages[op.page];
    if (!page) continue;
    if (op.type === 'text') {
      page.drawText(op.text, {
        x: op.x,
        y: PAGE_HEIGHT - op.y,
        size: op.size,
        font: fonts[op.font],
        color: rgb(...TONES[op.tone]),
      });
    } else {
      page.drawLine({
        start: { x: op.x, y: PAGE_HEIGHT - op.y },
        end: { x: op.x + op.width, y: PAGE_HEIGHT - op.y },
        thickness: 0.6,
        color: rgb(...RULE_COLOR),
      });
    }
  }

  doc.setTitle(cv.fullName ? `CV · ${cv.fullName}` : 'CV');
  if (cv.fullName) doc.setAuthor(cv.fullName);
  doc.setCreator('Propulsee');
  doc.setProducer('Propulsee');
  return doc.save();
}

/** Télécharge le CV adapté en PDF, sous le nom `fileName`. */
export async function downloadCvPdf(tailored: TailoredCv, fileName: string): Promise<void> {
  const bytes = await buildCvPdf(tailored);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Laisse au navigateur le temps de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
