import { PAGE_HEIGHT, PAGE_WIDTH, type CvLayout, type CvTone, type MeasureText } from './cv-layout';

/** Couleurs des documents, proches des aperçus affichés dans le panneau. */
const TONES: Record<CvTone, [number, number, number]> = {
  ink: [0.067, 0.067, 0.078],
  body: [0.2, 0.2, 0.23],
  muted: [0.47, 0.47, 0.52],
  accent: [0.149, 0.188, 0.42],
};
const RULE_COLOR: [number, number, number] = [0.898, 0.898, 0.918];

export interface PdfMeta {
  title: string;
  author?: string;
}

/**
 * Dessine une mise en page A4 en PDF. `layout` reçoit de quoi mesurer le texte et de quoi
 * le rendre dessinable par la police (`isSupported`). pdf-lib est chargé à la demande.
 */
export async function renderPdf(
  meta: PdfMeta,
  layout: (measure: MeasureText, isSupported: (codePoint: number) => boolean) => CvLayout,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const charset = new Set(fonts.regular.getCharacterSet());
  const result = layout(
    (text, size, font) => fonts[font].widthOfTextAtSize(text, size),
    (code) => charset.has(code),
  );

  const pages = Array.from({ length: result.pages }, () => doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  for (const op of result.ops) {
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

  doc.setTitle(meta.title);
  if (meta.author) doc.setAuthor(meta.author);
  doc.setCreator('Propulsee');
  doc.setProducer('Propulsee');
  return doc.save();
}

/** Télécharge un PDF sous le nom `fileName`. */
export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Laisse au navigateur le temps de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
