import { joinTextParts, type PdfTextPart } from './pdf-text';

export interface PdfText {
  text: string;
  pages: number;
}

type PdfJs = typeof import('pdfjs-dist');

let pdfjs: Promise<PdfJs> | undefined;

/** pdf.js est chargé à la demande, pour ne pas ralentir l'ouverture du panneau. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
  ]).then(([lib, { default: PdfWorker }]) => {
    // Worker bundlé par Vite (fichier .js de l'extension), compatible avec la CSP MV3.
    lib.GlobalWorkerOptions.workerPort = new PdfWorker();
    return lib;
  });
  return pdfjs;
}

/** Extrait le texte d'un PDF, page par page. */
export async function extractPdfText(file: Blob): Promise<PdfText> {
  const { getDocument } = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(joinTextParts(content.items as PdfTextPart[]));
    }
    return { text: pages.join('\n\n').trim(), pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}
